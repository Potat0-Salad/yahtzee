import { scoreForCategory } from '@/game/scoring'
import { CATEGORY_LABEL, LOWER_CATEGORIES } from '@/game/types'
import type { PlayerState } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'
import { ScoreCell } from './ScoreCell'

interface LowerSectionProps {
  player: PlayerState
  dice: number[]
  clickable: boolean
}

export function LowerSection({ player, dice, clickable }: LowerSectionProps) {
  const score = useGameStore((s) => s.score)

  return (
    <div className="flex flex-col gap-1">
      {LOWER_CATEGORIES.map((cat) => (
        <ScoreCell
          key={cat}
          label={CATEGORY_LABEL[cat]}
          value={player.scores[cat]}
          preview={scoreForCategory(dice, cat)}
          clickable={clickable}
          onClick={() => score(cat)}
        />
      ))}
      {player.yahtzeeBonusCount > 0 && (
        <div className="mt-1 flex items-center justify-between px-3 text-xs text-good">
          <span>Yahtzee bonus x{player.yahtzeeBonusCount}</span>
          <span className="font-mono tabular-nums">+{player.yahtzeeBonusCount * 100}</span>
        </div>
      )}
    </div>
  )
}
