from django.utils import timezone
from rest_framework import serializers

from core.game_engine import LOWER_CATEGORIES, UPPER_CATEGORIES, grand_total
from core.models import GamePlayer, GameSession, GuestProfile

UPPER_FIELDS = UPPER_CATEGORIES
LOWER_FIELDS = LOWER_CATEGORIES


class GuestProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestProfile
        fields = ["id", "display_name", "created_at"]


class GamePlayerSerializer(serializers.ModelSerializer):
    total = serializers.SerializerMethodField()

    class Meta:
        model = GamePlayer
        fields = [
            "display_name",
            "seat_order",
            *UPPER_FIELDS,
            *LOWER_FIELDS,
            "yahtzee_bonus_count",
            "total",
        ]
        extra_kwargs = {"seat_order": {"read_only": True}}

    def get_total(self, obj):
        return grand_total(obj)


class GameSessionSerializer(serializers.ModelSerializer):
    players = GamePlayerSerializer(many=True)

    class Meta:
        model = GameSession
        fields = ["id", "mode", "status", "created_at", "ended_at", "players"]
        read_only_fields = ["id", "status", "created_at", "ended_at"]

    def validate_players(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("A game needs at least 2 players.")
        return value

    def create(self, validated_data):
        players_data = validated_data.pop("players")
        session = GameSession.objects.create(
            mode=validated_data.get("mode", GameSession.Mode.LOCAL),
            status=GameSession.Status.COMPLETE,
            created_by=self.context["request"].user,
            ended_at=timezone.now(),
        )
        GamePlayer.objects.bulk_create(
            GamePlayer(session=session, seat_order=i, **player_data)
            for i, player_data in enumerate(players_data)
        )
        return session


class RoomPlayerSerializer(serializers.ModelSerializer):
    player_id = serializers.CharField(source="guest_id")

    class Meta:
        model = GamePlayer
        fields = ["player_id", "display_name", "seat_order", "is_connected"]


class RoomSerializer(serializers.ModelSerializer):
    """Lobby-facing view of a GameSession — no scores, just who's seated.
    Used by the pre-connect REST peek; the WebSocket's STATE_SYNC is the
    richer, live-game version of this."""

    players = RoomPlayerSerializer(many=True)

    class Meta:
        model = GameSession
        fields = ["room_code", "phase", "max_players", "players"]
