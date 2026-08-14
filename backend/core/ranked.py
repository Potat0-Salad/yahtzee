"""Elo rating math and ranked-match settlement.

No matchmaking exists yet — Phase 4 is schema and rating math only. A
ranked match is created the same way an online one is (see
core.views.create_room), just tagged mode=ranked; apply_ranked_results()
is called once a ranked GameSession reaches GAME_OVER.
"""

from core.game_engine import grand_total
from core.models import GamePlayer, GameSession, RankedStats

K_FACTOR = 32
K_FACTOR_PLACEMENT = 64  # faster convergence during a guest's first PLACEMENT_GAMES


def expected_score(rating_a: int, rating_b: int) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))


def _pairwise_outcome(rank_a: int, rank_b: int) -> float:
    if rank_a < rank_b:
        return 1.0
    if rank_a > rank_b:
        return 0.0
    return 0.5


def _competition_ranks(scores: list[int]) -> list[int]:
    """0-indexed standard competition ranking — ties share a rank, and the
    next distinct score skips ahead by the tie count (0, 1, 1, 3, ...)."""
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    ranks = [0] * len(scores)
    for position, idx in enumerate(order):
        prev = order[position - 1]
        ranks[idx] = ranks[prev] if position > 0 and scores[idx] == scores[prev] else position
    return ranks


def compute_elo_deltas(entries: list[dict]) -> dict[str, int]:
    """entries: [{"key": hashable, "rating": int, "score": int, "in_placement": bool}, ...]

    An N-player free-for-all generalization of Elo: each player's actual
    result is their average pairwise outcome (win/draw/loss, by finishing
    score) against every opponent, compared against the average pairwise
    expected score their rating implied.
    """
    n = len(entries)
    if n < 2:
        return {e["key"]: 0 for e in entries}

    ranks = _competition_ranks([e["score"] for e in entries])
    deltas: dict[str, int] = {}
    for i, entry in enumerate(entries):
        actual = sum(_pairwise_outcome(ranks[i], ranks[j]) for j in range(n) if j != i) / (n - 1)
        expected = sum(
            expected_score(entry["rating"], entries[j]["rating"]) for j in range(n) if j != i
        ) / (n - 1)
        k = K_FACTOR_PLACEMENT if entry["in_placement"] else K_FACTOR
        deltas[entry["key"]] = round(k * (actual - expected))
    return deltas


def apply_ranked_results(session: GameSession, players: list[GamePlayer]) -> None:
    """Settles Elo for a completed ranked match. No-op for any other mode."""
    if session.mode != GameSession.Mode.RANKED:
        return

    scored = [p for p in players if p.guest_id is not None]
    if len(scored) < 2:
        return

    stats_by_guest = {}
    entries = []
    for player in scored:
        stats, _ = RankedStats.objects.get_or_create(guest_id=player.guest_id)
        stats_by_guest[player.guest_id] = stats
        entries.append(
            {
                "key": player.guest_id,
                "rating": stats.elo_rating,
                "score": grand_total(player),
                "in_placement": stats.in_placement,
            }
        )

    deltas = compute_elo_deltas(entries)
    ranks = _competition_ranks([e["score"] for e in entries])

    for i, entry in enumerate(entries):
        stats = stats_by_guest[entry["key"]]
        stats.elo_rating = max(0, stats.elo_rating + deltas[entry["key"]])
        stats.games_played += 1
        if ranks[i] == 0:
            stats.wins += 1
        else:
            stats.losses += 1
        stats.save(update_fields=["elo_rating", "games_played", "wins", "losses", "updated_at"])
