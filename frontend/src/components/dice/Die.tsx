import { useEffect, useRef, useState } from 'react'
import { ROLL_LAND_MS, ROLL_SHAKE_MS } from '@/game/constants'
import { PIP_LAYOUT } from './pipLayout'

interface DieProps {
  value: number
  held: boolean
  rollToken: number
  interactive: boolean
  onToggleHold: () => void
}

type Phase = 'idle' | 'shaking' | 'landing'
type Rotation = { x: number; y: number }

const SIZE = 48
const HALF = SIZE / 2
const PERSPECTIVE = 480

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: `translateZ(${HALF}px)` },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { value: 2, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { value: 5, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { value: 3, transform: `rotateX(-90deg) translateZ(${HALF}px)` },
  { value: 4, transform: `rotateX(90deg) translateZ(${HALF}px)` },
]

// Rotation that brings each value's face to point at the camera, canceling
// out that face's own static transform above.
const LAND_ROTATION: Record<number, Rotation> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: 90, y: 0 },
  4: { x: -90, y: 0 },
}

function mod360(deg: number) {
  return ((deg % 360) + 360) % 360
}

// Smallest step from `current`, continuing in `direction`, that lands on a
// rotation congruent to targetMod (mod 360) — so landing keeps spinning the
// way it was already spinning instead of snapping backwards.
function landingTarget(current: number, targetMod: number, direction: number, extraSpins: number) {
  const cur = mod360(current)
  let delta = targetMod - cur
  if (direction >= 0) {
    if (delta <= 0) delta += 360
  } else if (delta >= 0) {
    delta -= 360
  }
  return current + delta + Math.sign(direction || 1) * extraSpins * 360
}

export function Die({ value, held, rollToken, interactive, onToggleHold }: DieProps) {
  const cubeRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  // The rollToken we've already animated (or skipped) for. Comparing against
  // this — rather than a plain "have we mounted yet" flag — keeps a fresh
  // mount (a new player's turn swaps PassOverlay back out for the dice)
  // from spinning for a roll that already happened last turn. A boolean
  // mounted-flag doesn't survive React StrictMode's dev-only double-invoke
  // of mount effects, which was letting that stale rollToken slip through
  // on the second invocation and trigger a spurious spin.
  const lastAnimatedToken = useRef(rollToken)
  const rot = useRef<Rotation>(LAND_ROTATION[1])

  useEffect(() => {
    const applyTransform = () => {
      if (cubeRef.current) {
        cubeRef.current.style.transform = `rotateX(${rot.current.x}deg) rotateY(${rot.current.y}deg)`
      }
    }

    if (held || rollToken === lastAnimatedToken.current) {
      rot.current = { ...LAND_ROTATION[Math.max(value, 1)] }
      applyTransform()
      return
    }
    lastAnimatedToken.current = rollToken
    if (rollToken === 0) return

    setPhase('shaking')
    const dirX = Math.random() < 0.5 ? -1 : 1
    const dirY = Math.random() < 0.5 ? -1 : 1
    const speedX = dirX * (420 + Math.random() * 280)
    const speedY = dirY * (520 + Math.random() * 380)

    let raf = 0
    let last = performance.now()
    const spinUntil = last + ROLL_SHAKE_MS

    const spinStep = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      rot.current = { x: rot.current.x + speedX * dt, y: rot.current.y + speedY * dt }
      applyTransform()
      if (now < spinUntil) {
        raf = requestAnimationFrame(spinStep)
      } else {
        beginLanding()
      }
    }

    const beginLanding = () => {
      setPhase('landing')
      const target = LAND_ROTATION[value]
      const from = { ...rot.current }
      const to = {
        x: landingTarget(from.x, mod360(target.x), dirX, 0),
        y: landingTarget(from.y, mod360(target.y), dirY, 1),
      }
      const start = performance.now()

      const landStep = (now: number) => {
        const t = Math.min(1, (now - start) / ROLL_LAND_MS)
        const eased = 1 - (1 - t) ** 3
        rot.current = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased }
        applyTransform()
        if (t < 1) {
          raf = requestAnimationFrame(landStep)
        } else {
          rot.current = to
          applyTransform()
          setPhase('idle')
        }
      }
      raf = requestAnimationFrame(landStep)
    }

    raf = requestAnimationFrame(spinStep)
    return () => cancelAnimationFrame(raf)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only rollToken should retrigger a roll; held/value are read fresh each time it fires
  }, [rollToken])

  const animating = phase === 'shaking' || phase === 'landing'
  const dimmed = !interactive && !animating

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onToggleHold}
      aria-pressed={held}
      aria-label={
        value === 0
          ? 'Die, not yet rolled'
          : held
            ? `Die showing ${value}, held, tap to release`
            : `Die showing ${value}, tap to hold`
      }
      style={{ width: SIZE, height: SIZE, perspective: PERSPECTIVE }}
      className={`relative shrink-0 transition-[transform,opacity] duration-150 ${held ? '-translate-y-1' : ''} ${
        dimmed ? 'opacity-50' : ''
      } ${interactive && !held ? 'active:translate-y-0.5' : ''} ${
        phase === 'landing' ? 'animate-[dice-land_0.32s_ease-out_1] motion-reduce:animate-none' : ''
      }`}
    >
      <div
        ref={cubeRef}
        className="pointer-events-none absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {FACES.map((face) => (
          <div
            key={face.value}
            style={{ transform: face.transform, backfaceVisibility: 'hidden' }}
            className={`absolute inset-0 rounded-2xl border-[3px] bg-ink ${
              held
                ? 'border-accent shadow-[2px_2px_0_0_var(--color-accent)]'
                : 'border-line shadow-[2px_2px_0_0_var(--color-line)]'
            }`}
          >
            <span className="absolute inset-[16%] grid grid-cols-3 grid-rows-3">
              {PIP_LAYOUT[face.value].map((p, i) => (
                <span
                  key={i}
                  className="place-self-center h-[80%] w-[80%] rounded-full bg-line"
                  style={{ gridRow: p.row, gridColumn: p.col }}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}
