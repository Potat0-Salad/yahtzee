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

export type GameMode = 'local' | 'online'

export interface PlayerState {
  id: string
  name: string
  scores: Scorecard
  yahtzeeBonusCount: number
  // Online mode only: categories a live opponent has filled but whose values
  // the server hasn't revealed to us yet — used for scorecard-progress counts,
  // never for score values (we never render an opponent's score cells).
  hiddenCategories?: Category[]
  // Online mode only: server-authoritative total. Falls back to a locally
  // computed grandTotal() when absent (always the case in local mode).
  total?: number
  isConnected?: boolean
  isActive?: boolean
}

export type GamePhase =
  'setup' | 'lobby_waiting' | 'rolling' | 'selecting_keep' | 'intermission' | 'game_over'

export interface LastScored {
  playerId: string
  category: Category
  // Masked to null in online mode when the score belongs to another player.
  points: number | null
  bonus: number | null
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
