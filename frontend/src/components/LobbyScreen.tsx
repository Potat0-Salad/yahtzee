import { useState } from 'react'
import { ArrowLeft, Check, Copy, Play, Users, Wifi, WifiOff } from 'lucide-react'
import { MIN_PLAYERS } from '@/game/types'
import { useGameStore } from '@/store/useGameStore'

interface LobbyScreenProps {
  onBack: () => void
}

export function LobbyScreen({ onBack }: LobbyScreenProps) {
  const game = useGameStore((s) => s.game)
  const roomCode = useGameStore((s) => s.roomCode)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const connectionStatus = useGameStore((s) => s.connectionStatus)
  const actionError = useGameStore((s) => s.actionError)
  const createOnlineRoom = useGameStore((s) => s.createOnlineRoom)
  const joinOnlineRoom = useGameStore((s) => s.joinOnlineRoom)
  const startOnlineGame = useGameStore((s) => s.startOnlineGame)
  const resetToHome = useGameStore((s) => s.resetToHome)

  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const leave = () => {
    resetToHome()
    onBack()
  }

  const handleCreate = async () => {
    setBusy(true)
    setFormError(null)
    try {
      await createOnlineRoom()
    } catch {
      setFormError('Could not create a room. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (joinCode.trim().length !== 6) {
      setFormError('Room codes are 6 characters.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await joinOnlineRoom(joinCode)
    } catch {
      setFormError('Room not found.')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    if (!roomCode) return
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Not yet connected to a room — show the create/join form.
  if (!game) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
        <div className="text-center">
          <Wifi className="mx-auto text-accent" size={32} />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Private Lobby</h1>
          <p className="mt-1 text-sm text-ink-dim">Create a room or join one with a code.</p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-display text-base font-bold text-inset disabled:opacity-50"
        >
          {busy && connectionStatus === 'connecting' ? 'Creating…' : 'Create room'}
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
          <div className="h-px flex-1 bg-hairline" />
          or
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="w-full rounded-lg border border-hairline bg-surface px-4 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-ink placeholder:tracking-normal placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleJoin}
            className="flex items-center justify-center gap-2 rounded-xl border border-hairline-strong px-6 py-3 font-display text-base font-bold text-ink transition-colors hover:border-accent disabled:opacity-50"
          >
            Join room
          </button>
        </div>

        {formError && <p className="text-center text-sm text-warn">{formError}</p>}

        <button
          type="button"
          onClick={onBack}
          className="mx-auto flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </main>
    )
  }

  // Connected, waiting in the room for the host to start.
  const isHost = game.players[0]?.id === myPlayerId
  const canStart = game.players.length >= MIN_PLAYERS

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-ink-faint">Room code</p>
        <button
          type="button"
          onClick={copyCode}
          className="mx-auto mt-2 flex items-center gap-2 font-mono text-4xl font-extrabold tracking-[0.2em] text-ink"
        >
          {roomCode}
          {copied ? (
            <Check className="text-good" size={22} />
          ) : (
            <Copy className="text-ink-faint" size={22} />
          )}
        </button>
        {connectionStatus === 'reconnecting' && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-warn">
            <WifiOff size={14} />
            Reconnecting…
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm text-ink-dim">
          <Users size={14} />
          Players ({game.players.length}/6)
        </p>
        {game.players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-4 py-3"
          >
            <span className="font-display font-bold text-ink">
              {player.name}
              {player.id === myPlayerId && <span className="ml-1.5 text-ink-faint">(you)</span>}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${player.isConnected ? 'bg-good' : 'bg-ink-faint'}`}
            />
          </div>
        ))}
      </div>

      {actionError && <p className="text-center text-sm text-warn">{actionError}</p>}

      {isHost ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={startOnlineGame}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-display text-base font-bold text-inset disabled:opacity-40"
        >
          <Play size={18} />
          {canStart ? 'Start game' : `Waiting for ${MIN_PLAYERS - game.players.length} more`}
        </button>
      ) : (
        <p className="text-center text-sm text-ink-dim">Waiting for the host to start…</p>
      )}

      <button
        type="button"
        onClick={leave}
        className="mx-auto flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Leave
      </button>
    </main>
  )
}
