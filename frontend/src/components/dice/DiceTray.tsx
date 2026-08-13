import { useGameStore } from '@/store/useGameStore'
import { Die } from './Die'

export function DiceTray() {
  const game = useGameStore((s) => s.game)
  const rollToken = useGameStore((s) => s.rollToken)
  const toggleHold = useGameStore((s) => s.toggleHold)
  if (!game) return null

  const interactive = game.phase === 'selecting_keep' && game.rollNumber >= 1

  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-10 sm:gap-4">
      {game.dice.map((value, i) => (
        <Die
          key={i}
          value={value}
          held={game.held[i]}
          rollToken={rollToken}
          interactive={interactive}
          onToggleHold={() => toggleHold(i)}
        />
      ))}
    </div>
  )
}
