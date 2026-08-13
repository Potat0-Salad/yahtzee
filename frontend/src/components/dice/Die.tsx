import { useEffect, useRef, useState } from 'react'
import { rollDie } from '@/game/dice'
import { ROLL_SHAKE_MS } from '@/game/constants'
import { PIP_LAYOUT } from './pipLayout'

interface DieProps {
  value: number
  held: boolean
  rollToken: number
  interactive: boolean
  onToggleHold: () => void
}

type Phase = 'idle' | 'shaking' | 'landing'

const SHAKE_TICK_MS = 70

export function Die({ value, held, rollToken, interactive, onToggleHold }: DieProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [phase, setPhase] = useState<Phase>('idle')
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (held || rollToken === 0) return

    setPhase('shaking')
    const interval = setInterval(() => setDisplayValue(rollDie()), SHAKE_TICK_MS)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setDisplayValue(value)
      setPhase('landing')
    }, ROLL_SHAKE_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only rollToken should retrigger a shake; held/value are read fresh each time it fires
  }, [rollToken])

  const pips = PIP_LAYOUT[displayValue] ?? []
  const animating = phase === 'shaking' || phase === 'landing'
  const dimmed = !interactive && !animating

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onToggleHold}
      onAnimationEnd={() => phase === 'landing' && setPhase('idle')}
      aria-pressed={held}
      aria-label={
        held ? `Die showing ${value}, held, tap to release` : `Die showing ${value}, tap to hold`
      }
      className={`relative h-16 w-16 shrink-0 rounded-2xl border-[4px] transition-[transform,box-shadow] duration-150 sm:h-20 sm:w-20 ${
        held
          ? 'border-accent bg-ink shadow-[4px_4px_0_0_var(--color-accent)] -translate-y-1'
          : 'border-line bg-ink shadow-[4px_4px_0_0_var(--color-line)]'
      } ${dimmed ? 'opacity-50' : ''} ${interactive && !held ? 'active:translate-y-0.5 active:shadow-[2px_2px_0_0_var(--color-line)]' : ''} ${
        phase === 'shaking' ? 'animate-[dice-shake_0.28s_ease-in-out_infinite]' : ''
      } ${phase === 'landing' ? 'animate-[dice-land_0.32s_ease-out_1]' : ''}`}
    >
      <span className="absolute inset-[16%] grid grid-cols-3 grid-rows-3">
        {pips.map((p, i) => (
          <span
            key={i}
            className="place-self-center h-[80%] w-[80%] rounded-full bg-line"
            style={{ gridRow: p.row, gridColumn: p.col }}
          />
        ))}
      </span>
    </button>
  )
}
