import uuid

from django.conf import settings
from django.db import models


class GuestProfile(models.Model):
    """Anonymous player identity, upgradable to a full account later.

    Duck-types as authenticated for DRF's IsAuthenticated permission check
    (see core.authentication.GuestTokenAuthentication) — there's no
    Django auth User involved for guest sessions, only this model.
    """

    is_authenticated = True

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=32, default="Guest")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="guest_profile",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name} ({self.id})"


class GameSession(models.Model):
    """One match, of any mode. For online games this row *is* the live
    authoritative state — the Channels consumer reads/writes it directly
    rather than through a separate cache; a turn-based dice game just
    doesn't generate enough traffic to need one."""

    class Mode(models.TextChoices):
        LOCAL = "local", "Pass & Play"
        ONLINE = "online", "Private Lobby"
        RANKED = "ranked", "Ranked"

    class Status(models.TextChoices):
        LOBBY_WAITING = "lobby_waiting", "Waiting for players"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"
        ABANDONED = "abandoned", "Abandoned"

    class Phase(models.TextChoices):
        LOBBY_WAITING = "lobby_waiting", "Waiting for players"
        SELECTING_KEEP = "selecting_keep", "Selecting keep"
        INTERMISSION = "intermission", "Intermission"
        GAME_OVER = "game_over", "Game over"
        # "rolling" is deliberately not a server phase: dice resolve
        # atomically here, and the brief "still animating" window is a
        # client-only cosmetic overlay (see useGameStore) — same as how
        # local Pass & Play already handles it.

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode = models.CharField(max_length=8, choices=Mode.choices, default=Mode.LOCAL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETE)
    created_by = models.ForeignKey(
        GuestProfile, on_delete=models.CASCADE, related_name="sessions_created"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    # --- online-only live state (unused/default for local/ranked rows) ---
    room_code = models.CharField(max_length=6, unique=True, null=True, blank=True, db_index=True)
    max_players = models.PositiveSmallIntegerField(default=6)
    turn_timer_seconds = models.PositiveSmallIntegerField(default=30)
    phase = models.CharField(max_length=16, choices=Phase.choices, default=Phase.LOBBY_WAITING)
    turn_number = models.PositiveSmallIntegerField(default=1)
    roll_number = models.PositiveSmallIntegerField(default=0)
    active_seat = models.PositiveSmallIntegerField(default=0)
    dice = models.JSONField(default=list, blank=True)
    held = models.JSONField(default=list, blank=True)
    last_scored = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_mode_display()} session {self.id}"


class GamePlayer(models.Model):
    """One seat's final scorecard for a GameSession."""

    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="players")
    guest = models.ForeignKey(
        GuestProfile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="games_played",
    )
    display_name = models.CharField(max_length=32)
    seat_order = models.PositiveSmallIntegerField()

    # --- online-only connection state ---
    is_connected = models.BooleanField(default=True)
    disconnected_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    ones = models.PositiveSmallIntegerField(null=True, blank=True)
    twos = models.PositiveSmallIntegerField(null=True, blank=True)
    threes = models.PositiveSmallIntegerField(null=True, blank=True)
    fours = models.PositiveSmallIntegerField(null=True, blank=True)
    fives = models.PositiveSmallIntegerField(null=True, blank=True)
    sixes = models.PositiveSmallIntegerField(null=True, blank=True)
    three_kind = models.PositiveSmallIntegerField(null=True, blank=True)
    four_kind = models.PositiveSmallIntegerField(null=True, blank=True)
    full_house = models.PositiveSmallIntegerField(null=True, blank=True)
    small_straight = models.PositiveSmallIntegerField(null=True, blank=True)
    large_straight = models.PositiveSmallIntegerField(null=True, blank=True)
    yahtzee = models.PositiveSmallIntegerField(null=True, blank=True)
    chance = models.PositiveSmallIntegerField(null=True, blank=True)
    yahtzee_bonus_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["seat_order"]
        unique_together = ("session", "seat_order")

    def __str__(self):
        return f"{self.display_name} in {self.session_id}"


class RankedStats(models.Model):
    """One guest's running Elo record. Created lazily on first read/write —
    there's no signup step, so most guests never have a row.

    No matchmaking exists yet (Phase 4 is schema + rating math only): a
    ranked match is created the same way an online one is, just tagged
    mode=ranked, and core.ranked computes deltas when it ends.
    """

    PLACEMENT_GAMES = 5
    STARTING_ELO = 1200

    guest = models.OneToOneField(
        GuestProfile, on_delete=models.CASCADE, related_name="ranked_stats"
    )
    elo_rating = models.IntegerField(default=STARTING_ELO)
    games_played = models.PositiveIntegerField(default=0)
    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.guest.display_name}: {self.elo_rating} elo ({self.games_played} games)"

    @property
    def in_placement(self) -> bool:
        return self.games_played < self.PLACEMENT_GAMES
