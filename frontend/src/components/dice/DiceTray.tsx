import { useGameStore } from '@/store/useGameStore'
import { Die } from './Die'

export function DiceTray() {
  const game = useGameStore((s) => s.game)
  const rollToken = useGameStore((s) => s.rollToken)
  const toggleHold = useGameStore((s) => s.toggleHold)
  if (!game) return null

  const interactive = game.phase === 'selecting_keep' && game.rollNumber >= 1

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-surface px-8 py-8 sm:py-10">
      <div className="flex items-center justify-center gap-8 sm:gap-10">
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
      <p className={`text-xs text-ink-faint ${interactive ? '' : 'invisible'}`}>
        Tap a die to hold it
      </p>
    </div>
  )
}
