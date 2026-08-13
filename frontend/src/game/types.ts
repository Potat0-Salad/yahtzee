export const CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'three_kind',
  'four_kind',
  'full_house',
  'small_straight',
  'large_straight',
  'yahtzee',
  'chance',
] as const

export type Category = (typeof CATEGORIES)[number]

export const UPPER_CATEGORIES: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes']
export const LOWER_CATEGORIES: Category[] = [
  'three_kind',
  'four_kind',
  'full_house',
  'small_straight',
  'large_straight',
  'yahtzee',
  'chance',
]

export const CATEGORY_LABEL: Record<Category, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  three_kind: '3 of a Kind',
  four_kind: '4 of a Kind',
  full_house: 'Full House',
  small_straight: 'Small Straight',
  large_straight: 'Large Straight',
  yahtzee: 'Yahtzee',
  chance: 'Chance',
}

export type Scorecard = Partial<Record<Category, number>>

export interface PlayerState {
  id: string
  name: string
  scores: Scorecard
  yahtzeeBonusCount: number
}

export type GamePhase = 'setup' | 'rolling' | 'selecting_keep' | 'intermission' | 'game_over'

export interface LastScored {
  playerId: string
  category: Category
  points: number
  bonus: number
}

export interface GameState {
  phase: GamePhase
  players: PlayerState[]
  activePlayerIndex: number
  turnNumber: number
  rollNumber: number
  dice: number[]
  held: boolean[]
  lastScored: LastScored | null
}

export const DICE_COUNT = 5
export const MAX_ROLLS = 3
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
