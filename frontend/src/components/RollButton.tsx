import { RotateCw } from 'lucide-react'
import * as engine from '@/game/engine'
import { MAX_ROLLS } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'

export function RollButton() {
  const game = useGameStore((s) => s.game)
  const roll = useGameStore((s) => s.roll)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  if (!game) return null

  const isMyTurn = !myPlayerId || engine.activePlayer(game).id === myPlayerId
  const enabled = isMyTurn && engine.canRoll(game)
  const rollsLeft = MAX_ROLLS - game.rollNumber
  const label =
    game.phase === 'rolling'
      ? 'Rolling…'
      : !isMyTurn
        ? `Waiting for ${engine.activePlayer(game).name}…`
        : game.rollNumber === 0
          ? 'Roll'
          : `Roll again (${rollsLeft} left)`

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={roll}
      className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-display text-base font-bold text-inset transition-opacity disabled:opacity-40"
    >
      <RotateCw size={18} className={game.phase === 'rolling' ? 'animate-spin' : ''} />
      {label}
    </button>
  )
}
