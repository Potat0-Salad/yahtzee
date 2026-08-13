import { apiFetch } from '@/lib/api'
import type { PlayerState } from '@/game/types'

export interface GamePlayerRecord {
  display_name: string
  seat_order: number
  total: number
}

export interface GameSessionRecord {
  id: string
  mode: string
  status: string
  created_at: string
  ended_at: string | null
  players: GamePlayerRecord[]
}

export function saveCompletedGame(players: PlayerState[]): Promise<GameSessionRecord> {
  return apiFetch<GameSessionRecord>('/games/', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'local',
      players: players.map((p) => ({
        display_name: p.name,
        yahtzee_bonus_count: p.yahtzeeBonusCount,
        ...p.scores,
      })),
    }),
  })
}

export function fetchGameHistory(): Promise<GameSessionRecord[]> {
  return apiFetch<GameSessionRecord[]>('/games/')
}
