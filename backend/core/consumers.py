"""WebSocket consumer for online play — one instance per connected player.

Protocol: every message (both directions) is
    {"type": "<EVENT>", "room_code": "...", "ts": "...", "payload": {...}}

Client -> server *intents*: ROLL_REQUEST, HOLD_REQUEST, SCORE_REQUEST,
CONTINUE_REQUEST, START_REQUEST. The server re-validates every one against
the current DB state before acting; invalid ones get an ERROR back, never
silently applied.

Server -> client *facts*: STATE_SYNC (sent only to the connecting client,
to catch it up), DICE_ROLLED, DICE_HELD, SCORE_SELECTED, TURN_CHANGED,
GAME_STARTED, GAME_OVER, PLAYER_JOINED, PLAYER_DISCONNECTED,
PLAYER_RECONNECTED, PLAYER_TIMEOUT, ERROR.

STATE_SYNC, GAME_STARTED, and ERROR aren't in the original blueprint's
protocol table — they turned out to be necessary once this got built:
STATE_SYNC catches up a (re)connecting client instead of leaving it
waiting for the next event, GAME_STARTED is the lobby->table transition,
and ERROR is what the blueprint's "rejected with an ERROR event" line
needed to actually mean something.

Dice values, scoring, and turn order are never trusted from the client —
see core.game_engine, the same rules frontend/src/game/engine.ts runs
locally for Pass & Play.
"""

import asyncio
import json
import urllib.parse
import uuid

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from core import game_engine as engine
from core.models import GamePlayer, GameSession, GuestProfile

RECONNECT_GRACE_SECONDS = 15


class GameConsumer(AsyncWebsocketConsumer):
    # --- connection lifecycle ---------------------------------------

    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"].upper()
        self.group_name = f"game_{self.room_code}"

        self.guest = await self._authenticate(self._token_from_query())
        if self.guest is None:
            await self.close(code=4001)
            return

        self.session_id = await self._get_session_id()
        if self.session_id is None:
            await self.close(code=4004)
            return

        seat_result = await self._seat_player()
        if seat_result is None:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        if seat_result in ("joined", "reconnected"):
            event_type = "PLAYER_JOINED" if seat_result == "joined" else "PLAYER_RECONNECTED"
            await self._group_broadcast(
                event_type,
                {"player_id": str(self.guest.id), "display_name": self.guest.display_name},
            )
        await self._send_state_sync()

    async def disconnect(self, close_code):
        if getattr(self, "guest", None) is None or getattr(self, "session_id", None) is None:
            return
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        still_active = await self._mark_disconnected()
        if not still_active:
            return
        await self._group_broadcast(
            "PLAYER_DISCONNECTED",
            {"player_id": str(self.guest.id), "grace_seconds": RECONNECT_GRACE_SECONDS},
        )
        asyncio.create_task(self._drop_after_grace())

    def _token_from_query(self):
        query = urllib.parse.parse_qs(self.scope.get("query_string", b"").decode())
        values = query.get("token")
        return values[0] if values else None

    # --- client -> server intents -------------------------------------

    async def receive(self, text_data):
        try:
            message = json.loads(text_data)
        except (TypeError, ValueError):
            return
        msg_type = message.get("type")
        payload = message.get("payload") or {}

        if msg_type == "ROLL_REQUEST":
            await self._respond("DICE_ROLLED", await self._do_roll())
        elif msg_type == "HOLD_REQUEST":
            await self._respond("DICE_HELD", await self._do_hold(payload.get("index")))
        elif msg_type == "SCORE_REQUEST":
            await self._respond("SCORE_SELECTED", await self._do_score(payload.get("category")))
        elif msg_type == "CONTINUE_REQUEST":
            await self._respond_continue(await self._do_continue())
        elif msg_type == "START_REQUEST":
            await self._respond("GAME_STARTED", await self._do_start())

    async def _respond(self, event_type, result):
        if result is None:
            await self._send_error(event_type)
            return
        await self._group_broadcast(event_type, result)

    async def _respond_continue(self, result):
        if result is None:
            await self._send_error("CONTINUE_REQUEST")
            return
        if result["game_over"]:
            await self._group_broadcast("GAME_OVER", {"players": result["players_summary"]})
        else:
            await self._group_broadcast(
                "TURN_CHANGED",
                {
                    "current_player_id": result["current_player_id"],
                    "turn_number": result["turn_number"],
                },
            )

    # --- DB-touching action handlers (sync, wrapped) -------------------

    @database_sync_to_async
    def _do_roll(self):
        session, players = self._load()
        if not self._is_my_turn(session, players) or not engine.can_roll(session):
            return None
        engine.roll(session)
        session.save()
        return {
            "player_id": str(self.guest.id),
            "turn_number": session.turn_number,
            "roll_number": session.roll_number,
            "dice": session.dice,
            "held": session.held,
        }

    @database_sync_to_async
    def _do_hold(self, index):
        if not isinstance(index, int) or not (0 <= index < engine.DICE_COUNT):
            return None
        session, players = self._load()
        if not self._is_my_turn(session, players) or not engine.can_toggle_hold(session):
            return None
        engine.toggle_hold(session, index)
        session.save()
        return {"player_id": str(self.guest.id), "held": session.held}

    @database_sync_to_async
    def _do_score(self, category):
        if category not in engine.CATEGORIES:
            return None
        session, players = self._load()
        if not self._is_my_turn(session, players):
            return None
        result = engine.score(session, players, category)
        if result is None:
            return None
        player = players[session.active_seat]
        session.save()
        player.save()
        return {
            "player_id": result["player_id"],
            "turn_number": session.turn_number,
            "category": result["category"],
            "points_awarded": result["points"],
            "bonus": result["bonus"],
            "running_total": engine.grand_total(player),
        }

    @database_sync_to_async
    def _do_continue(self):
        session, players = self._load()
        if session.phase != GameSession.Phase.INTERMISSION:
            return None
        if not session.last_scored or session.last_scored.get("player_id") != str(self.guest.id):
            return None
        engine.advance_turn(session, players)
        session.save()
        for p in players:
            p.save()
        if session.phase == GameSession.Phase.GAME_OVER:
            return {
                "game_over": True,
                "players_summary": [self._player_summary(p) for p in players],
            }
        return {
            "game_over": False,
            "turn_number": session.turn_number,
            "current_player_id": str(players[session.active_seat].guest_id),
        }

    @database_sync_to_async
    def _do_start(self):
        session, players = self._load()
        if not players or players[0].guest_id != self.guest.id:
            return None  # only the host (seat 0) can start
        if not engine.can_start(session, players):
            return None
        engine.start_game(session)
        session.save()
        return {
            "turn_number": session.turn_number,
            "current_player_id": str(players[session.active_seat].guest_id),
        }

    def _load(self):
        session = GameSession.objects.get(id=self.session_id)
        players = list(session.players.order_by("seat_order"))
        return session, players

    def _is_my_turn(self, session, players):
        return bool(players) and players[session.active_seat].guest_id == self.guest.id

    def _player_summary(self, player):
        data = {c: getattr(player, c) for c in engine.CATEGORIES}
        data["player_id"] = str(player.guest_id) if player.guest_id else None
        data["display_name"] = player.display_name
        data["yahtzee_bonus_count"] = player.yahtzee_bonus_count
        data["total"] = engine.grand_total(player)
        return data

    # --- auth / seating -------------------------------------------------

    @database_sync_to_async
    def _authenticate(self, token):
        try:
            guest_id = uuid.UUID(token)
        except (TypeError, ValueError):
            return None
        return GuestProfile.objects.filter(id=guest_id).first()

    @database_sync_to_async
    def _get_session_id(self):
        session = GameSession.objects.filter(
            room_code=self.room_code, mode=GameSession.Mode.ONLINE
        ).first()
        return session.id if session else None

    @database_sync_to_async
    def _seat_player(self):
        """Returns "joined" | "reconnected" | "already_connected" | None (rejected)."""
        session = GameSession.objects.get(id=self.session_id)
        players = list(session.players.order_by("seat_order"))
        existing = next((p for p in players if p.guest_id == self.guest.id), None)

        if existing:
            was_disconnected = not existing.is_connected
            existing.is_connected = True
            existing.disconnected_at = None
            existing.save(update_fields=["is_connected", "disconnected_at"])
            return "reconnected" if was_disconnected else "already_connected"

        if not engine.can_join(session, players):
            return None

        GamePlayer.objects.create(
            session=session,
            guest=self.guest,
            display_name=self.guest.display_name,
            seat_order=len(players),
        )
        return "joined"

    @database_sync_to_async
    def _mark_disconnected(self):
        try:
            player = GamePlayer.objects.get(session_id=self.session_id, guest_id=self.guest.id)
        except GamePlayer.DoesNotExist:
            return False
        if not player.is_active:
            return False  # already dropped, nothing left to mark
        player.is_connected = False
        player.disconnected_at = timezone.now()
        player.save(update_fields=["is_connected", "disconnected_at"])
        return True

    # --- disconnect grace period -----------------------------------------

    async def _drop_after_grace(self):
        await asyncio.sleep(RECONNECT_GRACE_SECONDS)
        result = await self._finalize_drop()
        if result is None:
            return  # reconnected in time
        await self._group_broadcast(
            "PLAYER_TIMEOUT", {"player_id": result["player_id"], "reason": "disconnected"}
        )
        if result["game_over"]:
            await self._group_broadcast("GAME_OVER", {"players": result["players_summary"]})
        elif result["turn_changed"]:
            await self._group_broadcast(
                "TURN_CHANGED",
                {
                    "current_player_id": result["current_player_id"],
                    "turn_number": result["turn_number"],
                },
            )

    @database_sync_to_async
    def _finalize_drop(self):
        try:
            session = GameSession.objects.get(id=self.session_id)
        except GameSession.DoesNotExist:
            return None
        players = list(session.players.order_by("seat_order"))
        me = next((p for p in players if p.guest_id == self.guest.id), None)
        if me is None or me.is_connected or not me.is_active:
            return None  # reconnected, or already handled

        me.is_active = False
        me.save(update_fields=["is_active"])

        was_my_turn = (
            session.phase != GameSession.Phase.LOBBY_WAITING
            and players[session.active_seat].id == me.id
        )
        if was_my_turn:
            engine.drop_active_player_turn(session, players)
            session.save()

        game_over = session.phase == GameSession.Phase.GAME_OVER
        return {
            "player_id": str(me.guest_id),
            "game_over": game_over,
            "turn_changed": was_my_turn and not game_over,
            "current_player_id": str(players[session.active_seat].guest_id) if players else None,
            "turn_number": session.turn_number,
            "players_summary": [self._player_summary(p) for p in players] if game_over else None,
        }

    # --- state sync (sent only to the connecting client) -----------------

    async def _send_state_sync(self):
        payload = await self._build_state_sync()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "STATE_SYNC",
                    "room_code": self.room_code,
                    "ts": timezone.now().isoformat(),
                    "payload": payload,
                }
            )
        )

    @database_sync_to_async
    def _build_state_sync(self):
        session, players = self._load()
        return {
            "phase": session.phase,
            "turn_number": session.turn_number,
            "roll_number": session.roll_number,
            "dice": session.dice,
            "held": session.held,
            "active_seat": session.active_seat,
            "max_players": session.max_players,
            "players": [self._player_for_sync(p, session) for p in players],
            "last_scored": self._mask_last_scored(session.last_scored),
        }

    def _player_for_sync(self, player, session):
        base = {
            "player_id": str(player.guest_id) if player.guest_id else None,
            "display_name": player.display_name,
            "seat_order": player.seat_order,
            "is_connected": player.is_connected,
            "is_active": player.is_active,
            "categories_filled": [c for c in engine.CATEGORIES if getattr(player, c) is not None],
        }
        reveal = session.phase == GameSession.Phase.GAME_OVER or player.guest_id == self.guest.id
        if reveal:
            base.update({c: getattr(player, c) for c in engine.CATEGORIES})
            base["yahtzee_bonus_count"] = player.yahtzee_bonus_count
            base["total"] = engine.grand_total(player)
        return base

    def _mask_last_scored(self, last_scored):
        if not last_scored:
            return None
        if last_scored.get("player_id") == str(self.guest.id):
            return last_scored
        return {**last_scored, "points": None, "bonus": None}

    # --- group broadcast plumbing -----------------------------------------

    async def _group_broadcast(self, event_type, payload):
        await self.channel_layer.group_send(
            self.group_name, {"type": "broadcast", "event": event_type, "payload": payload}
        )

    async def _send_error(self, attempted):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "ERROR",
                    "room_code": self.room_code,
                    "ts": timezone.now().isoformat(),
                    "payload": {"reason": "invalid_action", "attempted": attempted},
                }
            )
        )

    async def broadcast(self, event):
        """Channels calls this on every consumer in the group for a
        {"type": "broadcast", ...} group_send. SCORE_SELECTED gets masked
        per-recipient here — everyone else in the group gets the same
        group_send call, but each consumer decides for itself whether the
        payload it forwards to its own socket includes the real score."""
        payload = event["payload"]
        if event["event"] == "SCORE_SELECTED" and payload.get("player_id") != str(self.guest.id):
            payload = {**payload, "points_awarded": None, "running_total": None, "bonus": None}
        await self.send(
            text_data=json.dumps(
                {
                    "type": event["event"],
                    "room_code": self.room_code,
                    "ts": timezone.now().isoformat(),
                    "payload": payload,
                }
            )
        )
