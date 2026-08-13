import * as engine from '@/game/engine'
import { displayTotal } from '@/game/scoring'
import { useGameStore } from '@/store/useGameStore'
import { LowerSection } from './LowerSection'
import { UpperSection } from './UpperSection'

export function ScoreCard() {
  const game = useGameStore((s) => s.game)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  if (!game) return null

  // Local mode shares one device, so it always shows whoever's turn it is.
  // Online mode always shows my own card — I always know my own scores,
  // and I can only ever score on my own turn anyway.
  const active = engine.activePlayer(game)
  const player = myPlayerId ? (game.players.find((p) => p.id === myPlayerId) ?? active) : active
  const clickable = engine.canScore(game) && player.id === active.id

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">{player.name}</h2>
        <span className="font-mono text-sm text-ink-faint">Total {displayTotal(player)}</span>
      </div>
      <UpperSection player={player} dice={game.dice} clickable={clickable} />
      <div className="h-px bg-hairline" />
      <LowerSection player={player} dice={game.dice} clickable={clickable} />
    </div>
  )
}
