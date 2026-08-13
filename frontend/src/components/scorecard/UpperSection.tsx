import { scoreForCategory, upperBonus, upperTotal } from '@/game/scoring'
import { CATEGORY_LABEL, UPPER_CATEGORIES } from '@/game/types'
import type { PlayerState } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'
import { ScoreCell } from './ScoreCell'

interface UpperSectionProps {
  player: PlayerState
  dice: number[]
  clickable: boolean
}

export function UpperSection({ player, dice, clickable }: UpperSectionProps) {
  const score = useGameStore((s) => s.score)
  const total = upperTotal(player.scores)
  const bonus = upperBonus(player.scores)

  return (
    <div className="flex flex-col gap-1">
      {UPPER_CATEGORIES.map((cat) => (
        <ScoreCell
          key={cat}
          label={CATEGORY_LABEL[cat]}
          value={player.scores[cat]}
          preview={scoreForCategory(dice, cat)}
          clickable={clickable}
          onClick={() => score(cat)}
        />
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-hairline px-3 pt-2 text-xs text-ink-faint">
        <span>Bonus at 63+</span>
        <span className="font-mono tabular-nums">
          {total}/63 {bonus > 0 && <span className="text-good">+35</span>}
        </span>
      </div>
    </div>
  )
}
