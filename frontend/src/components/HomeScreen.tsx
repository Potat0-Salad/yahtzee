import { Dices, Swords, Wifi } from 'lucide-react'

interface HomeScreenProps {
  onSelectPassPlay: () => void
}

export function HomeScreen({ onSelectPassPlay }: HomeScreenProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <Dices className="text-accent" size={40} />
        <h1 className="font-display text-4xl font-extrabold text-ink">Yahtzee</h1>
        <p className="text-ink-dim">Pass the phone, roll the dice.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectPassPlay}
          className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-5 py-4 text-left transition-colors hover:border-accent"
        >
          <div>
            <p className="font-display text-lg font-bold text-ink">Pass &amp; Play</p>
            <p className="text-sm text-ink-dim">2–6 players, one device</p>
          </div>
          <Dices className="text-accent" size={22} />
        </button>

        <div className="flex items-center justify-between rounded-2xl border border-hairline px-5 py-4 opacity-50">
          <div>
            <p className="font-display text-lg font-bold text-ink">Private Lobby</p>
            <p className="text-sm text-ink-dim">Play online with a room code</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              Phase 3
            </span>
            <Wifi className="text-ink-faint" size={22} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-hairline px-5 py-4 opacity-50">
          <div>
            <p className="font-display text-lg font-bold text-ink">Ranked</p>
            <p className="text-sm text-ink-dim">Matchmaking &amp; ELO</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              Phase 4
            </span>
            <Swords className="text-ink-faint" size={22} />
          </div>
        </div>
      </div>
    </main>
  )
}
