import { useState } from 'react'
import { Play, Trash2, UserPlus } from 'lucide-react'
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/types'

interface PassPlaySetupProps {
  onStart: (names: string[]) => void
}

export function PassPlaySetup({ onStart }: PassPlaySetupProps) {
  const [names, setNames] = useState<string[]>(['', ''])

  const addPlayer = () => {
    if (names.length >= MAX_PLAYERS) return
    setNames([...names, ''])
  }

  const removePlayer = (index: number) => {
    if (names.length <= MIN_PLAYERS) return
    setNames(names.filter((_, i) => i !== index))
  }

  const updateName = (index: number, value: string) => {
    setNames(names.map((n, i) => (i === index ? value : n)))
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Who's playing?</h1>
        <p className="mt-1 text-sm text-ink-dim">2 to 6 players, passed one device at a time.</p>
      </div>

      <div className="flex flex-col gap-2">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder={`Player ${i + 1}`}
              maxLength={20}
              className="flex-1 rounded-lg border border-hairline bg-surface px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            {names.length > MIN_PLAYERS && (
              <button
                type="button"
                onClick={() => removePlayer(i)}
                aria-label={`Remove player ${i + 1}`}
                className="rounded-lg p-2.5 text-ink-faint transition-colors hover:text-warn"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}

        {names.length < MAX_PLAYERS && (
          <button
            type="button"
            onClick={addPlayer}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-strong py-2.5 text-sm text-ink-dim transition-colors hover:border-accent hover:text-accent"
          >
            <UserPlus size={16} />
            Add player
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onStart(names)}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-display text-base font-bold text-inset"
      >
        <Play size={18} />
        Start game
      </button>
    </main>
  )
}
