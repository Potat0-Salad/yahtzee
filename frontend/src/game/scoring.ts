import type { Category, PlayerState, Scorecard } from './types'
import { UPPER_CATEGORIES } from './types'

function counts(dice: number[]): Record<number, number> {
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (const d of dice) c[d] += 1
  return c
}

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0)
}

function hasCountOf(c: Record<number, number>, n: number): boolean {
  return Object.values(c).some((v) => v >= n)
}

function isFullHouse(c: Record<number, number>): boolean {
  const values = Object.values(c).filter((v) => v > 0)
  return values.includes(3) && values.includes(2)
}

function hasStraight(dice: number[], run: number[][]): boolean {
  const unique = new Set(dice)
  return run.some((seq) => seq.every((v) => unique.has(v)))
}

const SMALL_STRAIGHTS = [
  [1, 2, 3, 4],
  [2, 3, 4, 5],
  [3, 4, 5, 6],
]
const LARGE_STRAIGHTS = [
  [1, 2, 3, 4, 5],
  [2, 3, 4, 5, 6],
]

export function isYahtzee(dice: number[]): boolean {
  return hasCountOf(counts(dice), 5)
}

export function scoreForCategory(dice: number[], category: Category): number {
  const c = counts(dice)
  switch (category) {
    case 'ones':
      return c[1] * 1
    case 'twos':
      return c[2] * 2
    case 'threes':
      return c[3] * 3
    case 'fours':
      return c[4] * 4
    case 'fives':
      return c[5] * 5
    case 'sixes':
      return c[6] * 6
    case 'three_kind':
      return hasCountOf(c, 3) ? sum(dice) : 0
    case 'four_kind':
      return hasCountOf(c, 4) ? sum(dice) : 0
    case 'full_house':
      return isFullHouse(c) ? 25 : 0
    case 'small_straight':
      return hasStraight(dice, SMALL_STRAIGHTS) ? 30 : 0
    case 'large_straight':
      return hasStraight(dice, LARGE_STRAIGHTS) ? 40 : 0
    case 'yahtzee':
      return isYahtzee(dice) ? 50 : 0
    case 'chance':
      return sum(dice)
  }
}

export function upperTotal(scores: Scorecard): number {
  return UPPER_CATEGORIES.reduce((total, cat) => total + (scores[cat] ?? 0), 0)
}

export function upperBonus(scores: Scorecard): number {
  return upperTotal(scores) >= 63 ? 35 : 0
}

export function lowerTotal(scores: Scorecard): number {
  return Object.entries(scores).reduce(
    (total, [cat, value]) =>
      UPPER_CATEGORIES.includes(cat as Category) ? total : total + (value ?? 0),
    0,
  )
}

export function grandTotal(player: PlayerState): number {
  return (
    upperTotal(player.scores) +
    upperBonus(player.scores) +
    lowerTotal(player.scores) +
    player.yahtzeeBonusCount * 100
  )
}

export function categoriesFilled(player: PlayerState): number {
  return Object.keys(player.scores).length
}
