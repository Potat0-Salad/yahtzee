import { API_BASE_URL } from '@/lib/api'

export interface WsEnvelope<T = Record<string, unknown>> {
  type: string
  room_code: string
  ts: string
  payload: T
}

function wsBaseUrl(): string {
  return API_BASE_URL.replace(/\/api\/?$/, '').replace(/^http/, 'ws')
}

export function openGameSocket(roomCode: string, guestId: string): WebSocket {
  const url = `${wsBaseUrl()}/ws/game/${roomCode}/?token=${encodeURIComponent(guestId)}`
  return new WebSocket(url)
}

export function sendIntent(ws: WebSocket, type: string, payload: Record<string, unknown> = {}) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type, payload }))
}
