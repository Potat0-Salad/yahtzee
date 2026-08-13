import { rollDie } from './dice'
import { grandTotal, isYahtzee, scoreForCategory } from './scoring'
import type { Category, GameState, PlayerState } from './types'
import { CATEGORIES, DICE_COUNT, MAX_ROLLS } from './types'

function emptyDice(): number[] {
  return Array(DICE_COUNT).fill(0)
}

function emptyHeld(): boolean[] {
  return Array(DICE_COUNT).fill(false)
}

export function createGame(names: string[]): GameState {
  const players: PlayerState[] = names.map((name, i) => ({
    id: `p${i}-${name.trim().toLowerCase().replace(/\s+/g, '-') || i}`,
    name: name.trim() || `Player ${i + 1}`,
    scores: {},
    yahtzeeBonusCount: 0,
  }))

  return {
    phase: 'selecting_keep',
    players,
    activePlayerIndex: 0,
    turnNumber: 1,
    rollNumber: 0,
    dice: emptyDice(),
    held: emptyHeld(),
    lastScored: null,
  }
}

export function activePlayer(state: GameState): PlayerState {
  return state.players[state.activePlayerIndex]
}

export function canRoll(state: GameState): boolean {
  return state.phase === 'selecting_keep' && state.rollNumber < MAX_ROLLS
}

export function canScore(state: GameState): boolean {
  return state.phase === 'selecting_keep' && state.rollNumber >= 1
}

export function isCategoryOpen(state: GameState, category: Category): boolean {
  return activePlayer(state).scores[category] === undefined
}

export function roll(state: GameState): GameState {
  if (!canRoll(state)) return state
  return {
    ...state,
    dice: state.dice.map((value, i) => (state.held[i] ? value : rollDie())),
    rollNumber: state.rollNumber + 1,
    phase: 'rolling',
  }
}

export function diceSettled(state: GameState): GameState {
  if (state.phase !== 'rolling') return state
  return { ...state, phase: 'selecting_keep' }
}

export function toggleHold(state: GameState, index: number): GameState {
  if (state.phase !== 'selecting_keep' || state.rollNumber === 0) return state
  return { ...state, held: state.held.map((h, i) => (i === index ? !h : h)) }
}

export function score(state: GameState, category: Category): GameState {
  if (!canScore(state) || !isCategoryOpen(state, category)) return state

  const points = scoreForCategory(state.dice, category)
  const player = activePlayer(state)
  const alreadyHasYahtzee = player.scores.yahtzee === 50
  const bonus = alreadyHasYahtzee && isYahtzee(state.dice) ? 100 : 0

  const updatedPlayer: PlayerState = {
    ...player,
    scores: { ...player.scores, [category]: points },
    yahtzeeBonusCount: player.yahtzeeBonusCount + (bonus > 0 ? 1 : 0),
  }

  const players = state.players.map((p, i) => (i === state.activePlayerIndex ? updatedPlayer : p))

  return {
    ...state,
    players,
    phase: 'intermission',
    lastScored: { playerId: player.id, category, points, bonus },
  }
}

function isGameOver(state: GameState): boolean {
  return state.players.every((p) => CATEGORIES.every((cat) => p.scores[cat] !== undefined))
}

export function advanceTurn(state: GameState): GameState {
  if (state.phase !== 'intermission') return state
  if (isGameOver(state)) return { ...state, phase: 'game_over' }

  const nextIndex = (state.activePlayerIndex + 1) % state.players.length
  return {
    ...state,
    phase: 'selecting_keep',
    activePlayerIndex: nextIndex,
    turnNumber: state.turnNumber + 1,
    rollNumber: 0,
    dice: emptyDice(),
    held: emptyHeld(),
  }
}

export function winners(state: GameState): PlayerState[] {
  if (state.players.length === 0) return []
  const totals = state.players.map((p) => grandTotal(p))
  const best = Math.max(...totals)
  return state.players.filter((_, i) => totals[i] === best)
}
