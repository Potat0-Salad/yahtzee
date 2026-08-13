import * as engine from '@/game/engine'
import { grandTotal } from '@/game/scoring'
import { useGameStore } from '@/store/useGameStore'
import { LowerSection } from './LowerSection'
import { UpperSection } from './UpperSection'

export function ScoreCard() {
  const game = useGameStore((s) => s.game)
  if (!game) return null

  const player = engine.activePlayer(game)
  const clickable = engine.canScore(game)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">{player.name}</h2>
        <span className="font-mono text-sm text-ink-faint">Total {grandTotal(player)}</span>
      </div>
      <UpperSection player={player} dice={game.dice} clickable={clickable} />
      <div className="h-px bg-hairline" />
      <LowerSection player={player} dice={game.dice} clickable={clickable} />
    </div>
  )
}
