import { categoriesFilled } from '@/game/scoring'
import { useGameStore } from '@/store/useGameStore'

export function PlayerRail() {
  const game = useGameStore((s) => s.game)
  if (!game) return null

  return (
    <div className="flex flex-wrap gap-2">
      {game.players.map((player, i) => {
        const active = i === game.activePlayerIndex
        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              active ? 'border-accent bg-accent-soft text-ink' : 'border-hairline text-ink-faint'
            }`}
          >
            <span className={`font-display font-bold ${active ? 'text-accent' : ''}`}>
              {player.name}
            </span>
            <span className="font-mono text-xs tabular-nums">{categoriesFilled(player)}/13</span>
          </div>
        )
      })}
    </div>
  )
}
