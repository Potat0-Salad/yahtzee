"""Server-authoritative game rules for online play.

A deliberate Python port of frontend/src/game/{engine,scoring}.ts — the two
must stay in sync. Local Pass & Play still runs the TS engine directly (no
server round-trip needed for a single device); this module exists so an
online opponent can't just edit their own dice values in devtools.

Functions here mutate the GameSession/GamePlayer instances passed in;
callers are responsible for saving. That's a deliberate departure from the
TS engine's pure-function style — plain mutation reads more naturally
against Django model instances than rebuilding dataclasses every call.
"""

import secrets
import string
from datetime import UTC, datetime

from core.models import GamePlayer, GameSession

DICE_COUNT = 5
MAX_ROLLS = 3
MIN_PLAYERS = 2
MAX_PLAYERS = 6

CATEGORIES = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "three_kind",
    "four_kind",
    "full_house",
    "small_straight",
    "large_straight",
    "yahtzee",
    "chance",
]
UPPER_CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes"]
LOWER_CATEGORIES = [c for c in CATEGORIES if c not in UPPER_CATEGORIES]

_ROOM_CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")


def generate_room_code() -> str:
    return "".join(secrets.choice(_ROOM_CODE_ALPHABET) for _ in range(6))


def roll_die() -> int:
    return secrets.randbelow(6) + 1


# --- scoring (mirrors scoring.ts) ---------------------------------------


def _counts(dice: list[int]) -> dict[int, int]:
    c = dict.fromkeys(range(1, 7), 0)
    for d in dice:
        c[d] += 1
    return c


def _is_full_house(c: dict[int, int]) -> bool:
    values = [v for v in c.values() if v > 0]
    return 3 in values and 2 in values


_SMALL_STRAIGHTS = [{1, 2, 3, 4}, {2, 3, 4, 5}, {3, 4, 5, 6}]
_LARGE_STRAIGHTS = [{1, 2, 3, 4, 5}, {2, 3, 4, 5, 6}]


def _has_straight(dice: list[int], straights: list[set[int]]) -> bool:
    unique = set(dice)
    return any(straight <= unique for straight in straights)


def is_yahtzee(dice: list[int]) -> bool:
    return max(_counts(dice).values()) >= 5


def score_for_category(dice: list[int], category: str) -> int:
    c = _counts(dice)
    total = sum(dice)
    if category in UPPER_CATEGORIES:
        face = UPPER_CATEGORIES.index(category) + 1
        return c[face] * face
    if category == "three_kind":
        return total if max(c.values()) >= 3 else 0
    if category == "four_kind":
        return total if max(c.values()) >= 4 else 0
    if category == "full_house":
        return 25 if _is_full_house(c) else 0
    if category == "small_straight":
        return 30 if _has_straight(dice, _SMALL_STRAIGHTS) else 0
    if category == "large_straight":
        return 40 if _has_straight(dice, _LARGE_STRAIGHTS) else 0
    if category == "yahtzee":
        return 50 if is_yahtzee(dice) else 0
    if category == "chance":
        return total
    raise ValueError(f"unknown category {category!r}")


def upper_total(player: GamePlayer) -> int:
    return sum(getattr(player, f) or 0 for f in UPPER_CATEGORIES)


def upper_bonus(player: GamePlayer) -> int:
    return 35 if upper_total(player) >= 63 else 0


def lower_total(player: GamePlayer) -> int:
    return sum(getattr(player, f) or 0 for f in LOWER_CATEGORIES)


def grand_total(player: GamePlayer) -> int:
    return (
        upper_total(player)
        + upper_bonus(player)
        + lower_total(player)
        + player.yahtzee_bonus_count * 100
    )


# --- lobby ----------------------------------------------------------------


def can_join(session: GameSession, players: list[GamePlayer]) -> bool:
    return session.phase == GameSession.Phase.LOBBY_WAITING and len(players) < session.max_players


def can_start(session: GameSession, players: list[GamePlayer]) -> bool:
    return session.phase == GameSession.Phase.LOBBY_WAITING and len(players) >= MIN_PLAYERS


def start_game(session: GameSession) -> None:
    session.status = GameSession.Status.IN_PROGRESS
    session.phase = GameSession.Phase.SELECTING_KEEP
    session.dice = [0] * DICE_COUNT
    session.held = [False] * DICE_COUNT
    session.active_seat = 0
    session.turn_number = 1
    session.roll_number = 0


# --- turn actions -----------------------------------------------------------


def active_player(session: GameSession, players: list[GamePlayer]) -> GamePlayer:
    return players[session.active_seat]


def can_roll(session: GameSession) -> bool:
    return session.phase == GameSession.Phase.SELECTING_KEEP and session.roll_number < MAX_ROLLS


def roll(session: GameSession) -> None:
    if not can_roll(session):
        return
    held = session.held or [False] * DICE_COUNT
    dice = session.dice or [0] * DICE_COUNT
    session.dice = [d if held[i] else roll_die() for i, d in enumerate(dice)]
    session.roll_number += 1
    # No rolls left after this one — nothing more to choose, so lock every
    # die (mirrors the frontend's auto-hold-on-final-roll behavior).
    if session.roll_number >= MAX_ROLLS:
        session.held = [True] * DICE_COUNT


def can_toggle_hold(session: GameSession) -> bool:
    return session.phase == GameSession.Phase.SELECTING_KEEP and session.roll_number >= 1


def toggle_hold(session: GameSession, index: int) -> None:
    if not can_toggle_hold(session):
        return
    held = list(session.held or [False] * DICE_COUNT)
    held[index] = not held[index]
    session.held = held


def can_score(session: GameSession) -> bool:
    return session.phase == GameSession.Phase.SELECTING_KEEP and session.roll_number >= 1


def is_category_open(player: GamePlayer, category: str) -> bool:
    return getattr(player, category) is None


def score(session: GameSession, players: list[GamePlayer], category: str) -> dict | None:
    """Applies `category` for the active player. Returns the broadcastable
    {player_id, category, points, bonus} dict, or None if the request was
    invalid (not their turn's window, category already filled, ...)."""
    if not can_score(session):
        return None
    player = active_player(session, players)
    if not is_category_open(player, category):
        return None

    points = score_for_category(session.dice, category)
    already_has_yahtzee = player.yahtzee == 50
    bonus = 100 if already_has_yahtzee and is_yahtzee(session.dice) else 0

    setattr(player, category, points)
    if bonus:
        player.yahtzee_bonus_count += 1

    session.phase = GameSession.Phase.INTERMISSION
    session.last_scored = {
        "player_id": str(player.guest_id),
        "category": category,
        "points": points,
        "bonus": bonus,
    }
    return session.last_scored


def _active_players(players: list[GamePlayer]) -> list[GamePlayer]:
    return [p for p in players if p.is_active]


def is_game_over(players: list[GamePlayer]) -> bool:
    active = _active_players(players)
    if len(players) > 1 and len(active) <= 1:
        return True  # everyone else dropped — last one standing wins
    return all(all(getattr(p, c) is not None for c in CATEGORIES) for p in active)


def _advance_to_next_active_seat(session: GameSession, players: list[GamePlayer]) -> None:
    if is_game_over(players):
        session.phase = GameSession.Phase.GAME_OVER
        session.status = GameSession.Status.COMPLETE
        session.ended_at = datetime.now(UTC)
        return

    n = len(players)
    next_seat = (session.active_seat + 1) % n
    tries = 0
    while not players[next_seat].is_active and tries < n:
        next_seat = (next_seat + 1) % n
        tries += 1

    session.active_seat = next_seat
    session.turn_number += 1
    session.roll_number = 0
    session.dice = [0] * DICE_COUNT
    session.held = [False] * DICE_COUNT
    session.phase = GameSession.Phase.SELECTING_KEEP


def advance_turn(session: GameSession, players: list[GamePlayer]) -> bool:
    if session.phase != GameSession.Phase.INTERMISSION:
        return False
    _advance_to_next_active_seat(session, players)
    return True


def drop_active_player_turn(session: GameSession, players: list[GamePlayer]) -> None:
    """The active player's 15s reconnect grace expired mid-turn — skip
    their turn without scoring anything."""
    _advance_to_next_active_seat(session, players)
