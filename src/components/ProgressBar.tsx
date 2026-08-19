interface ProgressBarProps { value: number; max: number; label: string }

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress-block">
      <div className="progress-copy"><span>{label}</span><span>{percentage}%</span></div>
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

