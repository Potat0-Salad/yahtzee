import { create } from 'zustand'
import { ROLL_TOTAL_MS } from '@/game/constants'
import * as engine from '@/game/engine'
import type { Category, GameMode, GameState, PlayerState } from '@/game/types'
import { CATEGORIES, DICE_COUNT } from '@/game/types'
import { createRoom, ensureGuestId, getRoom } from '@/lib/api'
import type { WsEnvelope } from '@/lib/ws'
import { openGameSocket, sendIntent } from '@/lib/ws'
import { saveCompletedGame } from '@/lib/gameHistory'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

interface GameStore {
  game: GameState | null
  rollToken: number
  awaitingReveal: boolean

  mode: GameMode | null
  roomCode: string | null
  myPlayerId: string | null
  connectionStatus: ConnectionStatus
  actionError: string | null

  // local mode
  startGame: (names: string[]) => void

  // online mode
  createOnlineRoom: () => Promise<string>
  joinOnlineRoom: (code: string) => Promise<void>
  startOnlineGame: () => void

  // shared, mode-aware
  roll: () => void
  toggleHold: (index: number) => void
  score: (category: Category) => void
  continueToNextTurn: () => void
  revealActivePlayer: () => void
  resetToHome: () => void
}

// The live WebSocket connection lives outside Zustand state — it's a side
// effectful resource, not serializable app state. `socket` always mirrors
// the most recently opened connection so a lagging onclose from a
// superseded socket can recognize itself as stale and no-op.
let socket: WebSocket | null = null

function emptyDice(): number[] {
  return Array(DICE_COUNT).fill(0)
}
function emptyHeld(): boolean[] {
  return Array(DICE_COUNT).fill(false)
}

interface ServerPlayer {
  player_id: string
  display_name: string
  seat_order: number
  is_connected: boolean
  is_active: boolean
  categories_filled: Category[]
  yahtzee_bonus_count?: number
  total?: number
  [category: string]: unknown
}

function translatePlayer(p: ServerPlayer): PlayerState {
  const revealed = p.total !== undefined
  const scores: PlayerState['scores'] = {}
  if (revealed) {
    for (const cat of CATEGORIES) {
      const value = p[cat]
      if (typeof value === 'number') scores[cat] = value
    }
  }
  return {
    id: p.player_id,
    name: p.display_name,
    scores,
    yahtzeeBonusCount: p.yahtzee_bonus_count ?? 0,
    hiddenCategories: revealed ? undefined : p.categories_filled,
    total: p.total,
    isConnected: p.is_connected,
    isActive: p.is_active,
  }
}

interface StateSyncPayload {
  phase: GameState['phase']
  turn_number: number
  roll_number: number
  dice: number[]
  held: boolean[]
  active_seat: number
  players: ServerPlayer[]
  last_scored: {
    player_id: string
    category: Category
    points: number | null
    bonus: number | null
  } | null
}

function translateStateSync(payload: StateSyncPayload): GameState {
  return {
    phase: payload.phase,
    players: payload.players.map(translatePlayer),
    activePlayerIndex: payload.active_seat,
    turnNumber: payload.turn_number,
    rollNumber: payload.roll_number,
    dice: payload.dice.length ? payload.dice : emptyDice(),
    held: payload.held.length ? payload.held : emptyHeld(),
    lastScored: payload.last_scored
      ? {
          playerId: payload.last_scored.player_id,
          category: payload.last_scored.category,
          points: payload.last_scored.points,
          bonus: payload.last_scored.bonus,
        }
      : null,
  }
}

type Get = () => GameStore
type Set = (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void

function dispatch(envelope: WsEnvelope, set: Set, get: Get) {
  const { game } = get()

  switch (envelope.type) {
    case 'STATE_SYNC': {
      set({ game: translateStateSync(envelope.payload as unknown as StateSyncPayload) })
      return
    }
    case 'PLAYER_JOINED': {
      if (!game) return
      const payload = envelope.payload as { player_id: string; display_name: string }
      if (game.players.some((p) => p.id === payload.player_id)) return
      set({
        game: {
          ...game,
          players: [
            ...game.players,
            {
              id: payload.player_id,
              name: payload.display_name,
              scores: {},
              yahtzeeBonusCount: 0,
              isConnected: true,
              isActive: true,
            },
          ],
        },
      })
      return
    }
    case 'PLAYER_DISCONNECTED': {
      if (!game) return
      const payload = envelope.payload as { player_id: string }
      set({
        game: {
          ...game,
          players: game.players.map((p) =>
            p.id === payload.player_id ? { ...p, isConnected: false } : p,
          ),
        },
      })
      return
    }
    case 'PLAYER_RECONNECTED': {
      if (!game) return
      const payload = envelope.payload as { player_id: string }
      set({
        game: {
          ...game,
          players: game.players.map((p) =>
            p.id === payload.player_id ? { ...p, isConnected: true } : p,
          ),
        },
      })
      return
    }
    case 'PLAYER_TIMEOUT': {
      if (!game) return
      const payload = envelope.payload as { player_id: string }
      set({
        game: {
          ...game,
          players: game.players.map((p) =>
            p.id === payload.player_id ? { ...p, isActive: false } : p,
          ),
        },
      })
      return
    }
    case 'GAME_STARTED': {
      if (!game) return
      const payload = envelope.payload as { turn_number: number; current_player_id: string }
      set({
        game: {
          ...game,
          phase: 'selecting_keep',
          activePlayerIndex: Math.max(
            0,
            game.players.findIndex((p) => p.id === payload.current_player_id),
          ),
          turnNumber: payload.turn_number,
          rollNumber: 0,
          dice: emptyDice(),
          held: emptyHeld(),
          lastScored: null,
        },
        awaitingReveal: false,
      })
      return
    }
    case 'DICE_ROLLED': {
      if (!game) return
      const payload = envelope.payload as {
        turn_number: number
        roll_number: number
        dice: number[]
        held: boolean[]
      }
      set({
        game: {
          ...game,
          phase: 'rolling',
          turnNumber: payload.turn_number,
          rollNumber: payload.roll_number,
          dice: payload.dice,
          held: payload.held,
        },
        rollToken: get().rollToken + 1,
      })
      setTimeout(() => {
        const current = get().game
        if (current?.phase === 'rolling') set({ game: { ...current, phase: 'selecting_keep' } })
      }, ROLL_TOTAL_MS)
      return
    }
    case 'DICE_HELD': {
      if (!game) return
      const payload = envelope.payload as { held: boolean[] }
      set({ game: { ...game, held: payload.held } })
      return
    }
    case 'SCORE_SELECTED': {
      if (!game) return
      const payload = envelope.payload as {
        player_id: string
        category: Category
        points_awarded: number | null
        bonus: number | null
        running_total: number | null
      }
      const revealed = payload.points_awarded !== null
      set({
        game: {
          ...game,
          phase: 'intermission',
          players: game.players.map((p) => {
            if (p.id !== payload.player_id) return p
            if (revealed) {
              return {
                ...p,
                scores: { ...p.scores, [payload.category]: payload.points_awarded as number },
                yahtzeeBonusCount: p.yahtzeeBonusCount + ((payload.bonus ?? 0) > 0 ? 1 : 0),
                total: payload.running_total ?? p.total,
              }
            }
            return {
              ...p,
              hiddenCategories: [...(p.hiddenCategories ?? []), payload.category],
            }
          }),
          lastScored: {
            playerId: payload.player_id,
            category: payload.category,
            points: payload.points_awarded,
            bonus: payload.bonus,
          },
        },
      })
      return
    }
    case 'TURN_CHANGED': {
      if (!game) return
      const payload = envelope.payload as { current_player_id: string; turn_number: number }
      set({
        game: {
          ...game,
          phase: 'selecting_keep',
          activePlayerIndex: Math.max(
            0,
            game.players.findIndex((p) => p.id === payload.current_player_id),
          ),
          turnNumber: payload.turn_number,
          rollNumber: 0,
          dice: emptyDice(),
          held: emptyHeld(),
          lastScored: null,
        },
      })
      return
    }
    case 'GAME_OVER': {
      if (!game) return
      const payload = envelope.payload as { players: ServerPlayer[] }
      set({
        game: {
          ...game,
          phase: 'game_over',
          players: payload.players.map(translatePlayer),
        },
      })
      return
    }
    case 'ERROR': {
      const payload = envelope.payload as { reason: string; attempted: string }
      set({ actionError: `${payload.attempted} failed: ${payload.reason}` })
      return
    }
    default:
      return
  }
}

function connectSocket(roomCode: string, guestId: string, set: Set, get: Get) {
  const ws = openGameSocket(roomCode, guestId)
  socket = ws
  set({ connectionStatus: 'connecting', mode: 'online', roomCode, myPlayerId: guestId })

  ws.onopen = () => {
    if (socket === ws) set({ connectionStatus: 'connected' })
  }
  ws.onmessage = (event) => {
    if (socket !== ws) return
    try {
      const envelope = JSON.parse(event.data as string) as WsEnvelope
      dispatch(envelope, set, get)
    } catch {
      // ignore malformed frames
    }
  }
  ws.onclose = () => {
    if (socket !== ws) return
    if (get().mode !== 'online') return // intentional teardown via resetToHome
    set({ connectionStatus: 'reconnecting' })
    setTimeout(() => {
      if (socket !== ws) return
      if (get().mode !== 'online') return
      connectSocket(roomCode, guestId, set, get)
    }, 2000)
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  rollToken: 0,
  awaitingReveal: false,

  mode: null,
  roomCode: null,
  myPlayerId: null,
  connectionStatus: 'idle',
  actionError: null,

  startGame: (names) => {
    set({ game: engine.createGame(names), rollToken: 0, awaitingReveal: true, mode: 'local' })
  },

  createOnlineRoom: async () => {
    const room = await createRoom()
    const guestId = await ensureGuestId()
    connectSocket(room.room_code, guestId, set, get)
    return room.room_code
  },

  joinOnlineRoom: async (code) => {
    const normalized = code.trim().toUpperCase()
    await getRoom(normalized) // validate the room exists before opening a socket
    const guestId = await ensureGuestId()
    connectSocket(normalized, guestId, set, get)
  },

  startOnlineGame: () => {
    if (socket) sendIntent(socket, 'START_REQUEST')
  },

  roll: () => {
    const { game, mode } = get()
    if (!game) return
    if (mode === 'online') {
      if (socket) sendIntent(socket, 'ROLL_REQUEST')
      return
    }
    if (!engine.canRoll(game)) return
    set({ game: engine.roll(game), rollToken: get().rollToken + 1 })

    setTimeout(() => {
      const current = get().game
      if (current) set({ game: engine.diceSettled(current) })
    }, ROLL_TOTAL_MS)
  },

  toggleHold: (index) => {
    const { game, mode } = get()
    if (!game) return
    if (mode === 'online') {
      if (socket) sendIntent(socket, 'HOLD_REQUEST', { index })
      return
    }
    set({ game: engine.toggleHold(game, index) })
  },

  score: (category) => {
    const { game, mode } = get()
    if (!game) return
    if (mode === 'online') {
      if (socket) sendIntent(socket, 'SCORE_REQUEST', { category })
      return
    }
    set({ game: engine.score(game, category) })
  },

  continueToNextTurn: () => {
    const { game, mode } = get()
    if (!game) return
    if (mode === 'online') {
      if (socket) sendIntent(socket, 'CONTINUE_REQUEST')
      return
    }
    const next = engine.advanceTurn(game)
    set({ game: next, awaitingReveal: next.phase !== 'game_over' })

    if (next.phase === 'game_over') {
      // Best-effort: history is a nice-to-have, never a reason to block play.
      saveCompletedGame(next.players).catch((err) => {
        console.warn('Failed to save game history', err)
      })
    }
  },

  revealActivePlayer: () => set({ awaitingReveal: false }),

  resetToHome: () => {
    if (socket) {
      socket.close()
      socket = null
    }
    set({
      game: null,
      rollToken: 0,
      awaitingReveal: false,
      mode: null,
      roomCode: null,
      myPlayerId: null,
      connectionStatus: 'idle',
      actionError: null,
    })
  },
}))
