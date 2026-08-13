import { ArrowRight } from 'lucide-react'
import * as engine from '@/game/engine'
import { CATEGORY_LABEL, MAX_ROLLS } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'

export function TurnBanner() {
  const game = useGameStore((s) => s.game)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const continueToNextTurn = useGameStore((s) => s.continueToNextTurn)
  if (!game) return null

  const player = engine.activePlayer(game)
  const isMyTurn = !myPlayerId || player.id === myPlayerId

  if (game.phase === 'intermission' && game.lastScored) {
    const { playerId, category, points, bonus } = game.lastScored
    const scorer = game.players.find((p) => p.id === playerId) ?? player
    const canContinue = !myPlayerId || playerId === myPlayerId

    return (
      <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-5 py-3">
        <div>
          <p className="text-sm text-ink-dim">
            {scorer.name} scored <span className="text-ink">{CATEGORY_LABEL[category]}</span>
          </p>
          {points !== null ? (
            <p className="font-mono text-lg font-bold text-accent">
              +{points}
              {bonus !== null && bonus > 0 && (
                <span className="ml-2 text-good">+{bonus} bonus</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-ink-faint">Score hidden until game over</p>
          )}
        </div>
        {canContinue ? (
          <button
            type="button"
            onClick={continueToNextTurn}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold text-inset"
          >
            Continue
            <ArrowRight size={16} />
          </button>
        ) : (
          <span className="text-sm text-ink-faint">Waiting for {scorer.name}…</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-5 py-3">
      <span className="font-display text-base font-bold text-ink">
        {isMyTurn ? 'Your turn' : `${player.name}'s turn`}
      </span>
      <span className="font-mono text-sm text-ink-faint">
        Roll {Math.min(game.rollNumber, MAX_ROLLS)}/{MAX_ROLLS}
      </span>
    </div>
  )
}
