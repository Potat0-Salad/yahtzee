import { useEffect, useState } from 'react'
import { ChevronLeft, Crown, History } from 'lucide-react'
import { fetchGameHistory, type GameSessionRecord } from '@/lib/gameHistory'

interface HistoryScreenProps {
  onBack: () => void
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const [games, setGames] = useState<GameSessionRecord[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchGameHistory()
      .then(setGames)
      .catch(() => setError(true))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="text-ink-faint transition-colors hover:text-ink"
        >
          <ChevronLeft size={22} />
        </button>
        <History className="text-accent" size={20} />
        <h1 className="font-display text-2xl font-bold text-ink">History</h1>
      </div>

      {error && (
        <p className="text-sm text-warn">Couldn't load history — is the backend running?</p>
      )}
      {!error && games === null && <p className="text-sm text-ink-faint">Loading…</p>}
      {games?.length === 0 && (
        <p className="text-sm text-ink-faint">
          No games yet — finish a Pass &amp; Play game to see it here.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {games?.map((game) => {
          const ranked = [...game.players].sort((a, b) => b.total - a.total)
          const topTotal = ranked[0]?.total
          return (
            <div key={game.id} className="rounded-2xl border border-hairline bg-surface p-4">
              <p className="mb-2 font-mono text-xs text-ink-faint">
                {new Date(game.created_at).toLocaleString()}
              </p>
              <div className="flex flex-col gap-1">
                {ranked.map((player) => (
                  <div
                    key={player.seat_order}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-1.5 text-ink">
                      {player.total === topTotal && <Crown size={14} className="text-accent" />}
                      {player.display_name}
                    </span>
                    <span className="font-mono tabular-nums text-ink-dim">{player.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
