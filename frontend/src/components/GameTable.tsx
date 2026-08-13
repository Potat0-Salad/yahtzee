import { DiceTray } from '@/components/dice/DiceTray'
import { GameOverScreen } from '@/components/GameOverScreen'
import { PassOverlay } from '@/components/PassOverlay'
import { PlayerRail } from '@/components/PlayerRail'
import { RollButton } from '@/components/RollButton'
import { ScoreCard } from '@/components/scorecard/ScoreCard'
import { TurnBanner } from '@/components/TurnBanner'
import { useGameStore } from '@/store/useGameStore'

export function GameTable() {
  const game = useGameStore((s) => s.game)
  const awaitingReveal = useGameStore((s) => s.awaitingReveal)
  if (!game) return null

  if (game.phase === 'game_over') return <GameOverScreen />
  if (awaitingReveal) return <PassOverlay />

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-4">
      <PlayerRail />
      <TurnBanner />

      <DiceTray />

      <div className="flex justify-center">
        <RollButton />
      </div>

      <ScoreCard />
    </main>
  )
}
