import { create } from 'zustand'
import { ROLL_TOTAL_MS } from '@/game/constants'
import * as engine from '@/game/engine'
import type { Category, GameState } from '@/game/types'

interface GameStore {
  game: GameState | null
  rollToken: number
  awaitingReveal: boolean

  startGame: (names: string[]) => void
  roll: () => void
  toggleHold: (index: number) => void
  score: (category: Category) => void
  continueToNextTurn: () => void
  revealActivePlayer: () => void
  resetToHome: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  rollToken: 0,
  awaitingReveal: false,

  startGame: (names) => {
    set({ game: engine.createGame(names), rollToken: 0, awaitingReveal: true })
  },

  roll: () => {
    const { game } = get()
    if (!game || !engine.canRoll(game)) return
    set({ game: engine.roll(game), rollToken: get().rollToken + 1 })

    setTimeout(() => {
      const current = get().game
      if (current) set({ game: engine.diceSettled(current) })
    }, ROLL_TOTAL_MS)
  },

  toggleHold: (index) => {
    const { game } = get()
    if (!game) return
    set({ game: engine.toggleHold(game, index) })
  },

  score: (category) => {
    const { game } = get()
    if (!game) return
    set({ game: engine.score(game, category) })
  },

  continueToNextTurn: () => {
    const { game } = get()
    if (!game) return
    const next = engine.advanceTurn(game)
    set({ game: next, awaitingReveal: next.phase !== 'game_over' })
  },

  revealActivePlayer: () => set({ awaitingReveal: false }),

  resetToHome: () => set({ game: null, rollToken: 0, awaitingReveal: false }),
}))
