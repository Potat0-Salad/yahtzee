import { useEffect, useState } from 'react'
import { GameTable } from '@/components/GameTable'
import { HomeScreen } from '@/components/HomeScreen'
import { PassPlaySetup } from '@/components/PassPlaySetup'
import { useGameStore } from '@/store/useGameStore'

type Screen = 'home' | 'setup' | 'table'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const game = useGameStore((s) => s.game)
  const startGame = useGameStore((s) => s.startGame)

  useEffect(() => {
    if (game && screen !== 'table') setScreen('table')
    if (!game && screen === 'table') setScreen('home')
  }, [game, screen])

  if (screen === 'home') {
    return <HomeScreen onSelectPassPlay={() => setScreen('setup')} />
  }

  if (screen === 'setup') {
    return <PassPlaySetup onStart={startGame} />
  }

  return <GameTable />
}

export default App
