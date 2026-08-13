export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const GUEST_ID_KEY = 'yahtzee.guestId'

let pendingGuestId: Promise<string> | null = null

async function createGuestSession(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/guest-session/`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to create guest session (${res.status})`)
  const data = (await res.json()) as { id: string }
  localStorage.setItem(GUEST_ID_KEY, data.id)
  return data.id
}

function ensureGuestId(): Promise<string> {
  const existing = localStorage.getItem(GUEST_ID_KEY)
  if (existing) return Promise.resolve(existing)
  // Multiple calls before the first response lands would otherwise each
  // create their own guest — share the in-flight request instead.
  pendingGuestId ??= createGuestSession().finally(() => {
    pendingGuestId = null
  })
  return pendingGuestId
}

export { ensureGuestId }

// Safe to call once ensureGuestId() has resolved at least once this session
// (e.g. right before opening a WebSocket, after a REST call already ran it).
export function getGuestId(): string | null {
  return localStorage.getItem(GUEST_ID_KEY)
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const guestId = await ensureGuestId()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestId}`,
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`API request to ${path} failed (${res.status})`)
  return res.json() as Promise<T>
}

export interface RoomPlayer {
  player_id: string
  display_name: string
  seat_order: number
  is_connected: boolean
}

export interface Room {
  room_code: string
  phase: string
  max_players: number
  players: RoomPlayer[]
}

export function createRoom(): Promise<Room> {
  return apiFetch<Room>('/rooms/', { method: 'POST' })
}

export function getRoom(code: string): Promise<Room> {
  return apiFetch<Room>(`/rooms/${code}/`)
}
