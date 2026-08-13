interface ScoreCellProps {
  label: string
  value: number | undefined
  preview: number | undefined
  clickable: boolean
  onClick: () => void
}

export function ScoreCell({ label, value, preview, clickable, onClick }: ScoreCellProps) {
  const filled = value !== undefined

  return (
    <button
      type="button"
      disabled={filled || !clickable}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
        filled
          ? 'cursor-default'
          : clickable
            ? 'cursor-pointer bg-accent-soft hover:bg-accent/25'
            : 'cursor-default opacity-60'
      }`}
    >
      <span className="text-sm text-ink-dim">{label}</span>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${
          filled ? 'text-ink' : clickable ? 'text-accent' : 'text-ink-faint'
        }`}
      >
        {filled ? value : clickable ? (preview ?? '—') : '—'}
      </span>
    </button>
  )
}
