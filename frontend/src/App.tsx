import { useEffect, useState } from 'react'
import { GameTable } from '@/components/GameTable'
import { HistoryScreen } from '@/components/HistoryScreen'
import { HomeScreen } from '@/components/HomeScreen'
import { LobbyScreen } from '@/components/LobbyScreen'
import { PassPlaySetup } from '@/components/PassPlaySetup'
import { useGameStore } from '@/store/useGameStore'

type Screen = 'home' | 'setup' | 'table' | 'history' | 'lobby'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const game = useGameStore((s) => s.game)
  const startGame = useGameStore((s) => s.startGame)

  useEffect(() => {
    if (game && game.phase !== 'lobby_waiting' && screen !== 'table') setScreen('table')
    if (!game && screen === 'table') setScreen('home')
  }, [game, screen])

  if (screen === 'home') {
    return (
      <HomeScreen
        onSelectPassPlay={() => setScreen('setup')}
        onSelectOnline={() => setScreen('lobby')}
        onViewHistory={() => setScreen('history')}
      />
    )
  }

  if (screen === 'setup') {
    return <PassPlaySetup onStart={startGame} />
  }

  if (screen === 'lobby') {
    return <LobbyScreen onBack={() => setScreen('home')} />
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('home')} />
  }

  return <GameTable />
}

export default App
