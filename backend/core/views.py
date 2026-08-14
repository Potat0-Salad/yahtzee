from rest_framework import mixins, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core import game_engine as engine
from core.models import GamePlayer, GameSession, GuestProfile, RankedStats
from core.serializers import (
    GameSessionSerializer,
    GuestProfileSerializer,
    RankedStatsSerializer,
    RoomSerializer,
)

ROOM_MODES = {GameSession.Mode.ONLINE, GameSession.Mode.RANKED}


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
def guest_session(request):
    guest = GuestProfile.objects.create()
    return Response(GuestProfileSerializer(guest).data, status=201)


class GameSessionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Save and list completed games. No update/destroy — history is immutable."""

    serializer_class = GameSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GameSession.objects.filter(created_by=self.request.user).prefetch_related("players")


def _unique_room_code() -> str:
    for _ in range(10):
        code = engine.generate_room_code()
        if not GameSession.objects.filter(room_code=code).exists():
            return code
    raise RuntimeError("Could not generate a unique room code after 10 attempts.")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_room(request):
    """Create a private lobby and seat the creator as its host (seat 0).
    Actually joining the WebSocket at ws/game/<room_code>/ is what seats
    every other player — this just gets the room (and the host's own
    seat) to exist first.

    mode defaults to "online"; pass "ranked" to have the match settle Elo
    on completion (core.ranked.apply_ranked_results) — there's no
    matchmaking yet, a ranked room is created and joined the same way."""
    mode = request.data.get("mode", GameSession.Mode.ONLINE)
    if mode not in ROOM_MODES:
        return Response({"detail": "mode must be 'online' or 'ranked'."}, status=400)

    session = GameSession.objects.create(
        mode=mode,
        status=GameSession.Status.LOBBY_WAITING,
        phase=GameSession.Phase.LOBBY_WAITING,
        created_by=request.user,
        room_code=_unique_room_code(),
    )
    GamePlayer.objects.create(
        session=session,
        guest=request.user,
        display_name=request.user.display_name,
        seat_order=0,
    )
    return Response(RoomSerializer(session).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def room_detail(request, room_code):
    """Lets the join screen validate a code and show who's already there
    before actually opening a WebSocket."""
    session = (
        GameSession.objects.filter(room_code=room_code.upper(), mode__in=ROOM_MODES)
        .prefetch_related("players")
        .first()
    )
    if session is None:
        return Response({"detail": "Room not found."}, status=404)
    return Response(RoomSerializer(session).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ranked_me(request):
    """My own ranked record, created lazily on first look — there's no
    signup step, so most guests never have a row until they finish a
    ranked match (or check this endpoint) for the first time."""
    stats, _ = RankedStats.objects.get_or_create(guest=request.user)
    return Response(RankedStatsSerializer(stats).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ranked_leaderboard(request):
    try:
        limit = min(int(request.query_params.get("limit", 20)), 100)
    except ValueError:
        return Response({"detail": "limit must be an integer."}, status=400)
    stats = RankedStats.objects.select_related("guest").order_by("-elo_rating")[:limit]
    return Response(RankedStatsSerializer(stats, many=True).data)
