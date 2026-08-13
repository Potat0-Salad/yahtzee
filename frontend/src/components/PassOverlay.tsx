import { Hand } from 'lucide-react'
import * as engine from '@/game/engine'
import { useGameStore } from '@/store/useGameStore'

export function PassOverlay() {
  const game = useGameStore((s) => s.game)
  const revealActivePlayer = useGameStore((s) => s.revealActivePlayer)
  if (!game) return null

  const player = engine.activePlayer(game)

  return (
    <button
      type="button"
      onClick={revealActivePlayer}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg text-center"
    >
      <Hand className="text-accent" size={36} />
      <p className="text-sm uppercase tracking-widest text-ink-faint">Pass the phone to</p>
      <h2 className="font-display text-4xl font-extrabold text-ink">{player.name}</h2>
      <p className="mt-2 text-sm text-ink-dim">Tap anywhere to reveal your turn</p>
    </button>
  )
}
