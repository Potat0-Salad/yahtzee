import { Crown, RotateCcw } from 'lucide-react'
import * as engine from '@/game/engine'
import { grandTotal } from '@/game/scoring'
import { useGameStore } from '@/store/useGameStore'

export function GameOverScreen() {
  const game = useGameStore((s) => s.game)
  const resetToHome = useGameStore((s) => s.resetToHome)
  if (!game) return null

  const winnerIds = new Set(engine.winners(game).map((p) => p.id))
  const ranked = [...game.players].sort((a, b) => grandTotal(b) - grandTotal(a))

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <Crown className="mx-auto text-accent" size={36} />
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">Game over</h1>
      </div>

      <div className="flex flex-col gap-2">
        {ranked.map((player, i) => (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-xl border px-5 py-3 ${
              winnerIds.has(player.id)
                ? 'border-accent bg-accent-soft'
                : 'border-hairline bg-surface'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-ink-faint">#{i + 1}</span>
              <span className="font-display font-bold text-ink">{player.name}</span>
              {winnerIds.has(player.id) && <Crown className="text-accent" size={16} />}
            </div>
            <span className="font-mono text-lg font-bold tabular-nums text-ink">
              {grandTotal(player)}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={resetToHome}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-display text-base font-bold text-inset"
      >
        <RotateCcw size={18} />
        New game
      </button>
    </main>
  )
}
