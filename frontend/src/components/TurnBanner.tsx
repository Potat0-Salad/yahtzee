import { ArrowRight } from 'lucide-react'
import * as engine from '@/game/engine'
import { CATEGORY_LABEL, MAX_ROLLS } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'

export function TurnBanner() {
  const game = useGameStore((s) => s.game)
  const continueToNextTurn = useGameStore((s) => s.continueToNextTurn)
  if (!game) return null

  const player = engine.activePlayer(game)

  if (game.phase === 'intermission' && game.lastScored) {
    const { category, points, bonus } = game.lastScored
    return (
      <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-5 py-3">
        <div>
          <p className="text-sm text-ink-dim">
            {player.name} scored <span className="text-ink">{CATEGORY_LABEL[category]}</span>
          </p>
          <p className="font-mono text-lg font-bold text-accent">
            +{points}
            {bonus > 0 && <span className="ml-2 text-good">+{bonus} bonus</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={continueToNextTurn}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold text-inset"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-5 py-3">
      <span className="font-display text-base font-bold text-ink">{player.name}'s turn</span>
      <span className="font-mono text-sm text-ink-faint">
        Roll {Math.min(game.rollNumber, MAX_ROLLS)}/{MAX_ROLLS}
      </span>
    </div>
  )
}
