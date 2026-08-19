interface LogoMarkProps { compact?: boolean }

export function LogoMark({ compact = false }: LogoMarkProps) {
  return <span className={`logo-mark${compact ? ' logo-mark--compact' : ''}`} aria-hidden="true">∞</span>
}

