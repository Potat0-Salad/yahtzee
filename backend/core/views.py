from rest_framework import mixins, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core import game_engine as engine
from core.models import GamePlayer, GameSession, GuestProfile
from core.serializers import GameSessionSerializer, GuestProfileSerializer, RoomSerializer


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
    seat) to exist first."""
    session = GameSession.objects.create(
        mode=GameSession.Mode.ONLINE,
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
        GameSession.objects.filter(room_code=room_code.upper(), mode=GameSession.Mode.ONLINE)
        .prefetch_related("players")
        .first()
    )
    if session is None:
        return Response({"detail": "Room not found."}, status=404)
    return Response(RoomSerializer(session).data)
