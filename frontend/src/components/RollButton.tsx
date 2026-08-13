import { RotateCw } from 'lucide-react'
import * as engine from '@/game/engine'
import { MAX_ROLLS } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'

export function RollButton() {
  const game = useGameStore((s) => s.game)
  const roll = useGameStore((s) => s.roll)
  if (!game) return null

  const enabled = engine.canRoll(game)
  const rollsLeft = MAX_ROLLS - game.rollNumber
  const label =
    game.phase === 'rolling'
      ? 'Rolling…'
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
