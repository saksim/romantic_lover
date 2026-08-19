import { useEffect, type CSSProperties } from 'react'

type CelebrationType = 'save' | 'complete' | 'capsule' | 'secret'

interface RomanceAtmosphereProps {
  enabled: boolean
}

interface CelebrationOverlayProps {
  type: CelebrationType
  nonce: number
  onDone: () => void
}

const petalStyles = Array.from({ length: 14 }, (_, index) => ({
  '--petal-left': `${(index * 17 + 7) % 100}%`,
  '--petal-delay': `${(index % 7) * -1.15}s`,
  '--petal-duration': `${8 + (index % 5) * 1.2}s`,
  '--petal-size': `${7 + (index % 4) * 2}px`,
  '--petal-drift': `${-28 + (index % 6) * 13}px`,
} as CSSProperties))

export function RomanceAtmosphere({ enabled }: RomanceAtmosphereProps) {
  if (!enabled) return null
  return (
    <div className="romance-atmosphere" aria-hidden="true">
      <div className="romance-glow romance-glow--one" />
      <div className="romance-glow romance-glow--two" />
      {petalStyles.map((style, index) => <span className="falling-petal" style={style} key={index} />)}
    </div>
  )
}

const celebrationCopy: Record<CelebrationType, { symbol: string; title: string; subtitle: string }> = {
  save: { symbol: '♥', title: '替未来的我们，收好啦', subtitle: '又多了一件值得期待的事' },
  complete: { symbol: '✓', title: '这一刻，被我们点亮了', subtitle: '愿望从今天开始成为回忆' },
  capsule: { symbol: '✦', title: '来自过去的信，打开了', subtitle: '时间替当时的我们保管得很好' },
  secret: { symbol: '∞', title: '未来没有最后一页', subtitle: '因为还有很多事，想继续和你一起' },
}

export function CelebrationOverlay({ type, nonce, onDone }: CelebrationOverlayProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, 1800)
    return () => window.clearTimeout(timeout)
  }, [nonce, onDone])

  const copy = celebrationCopy[type]
  return (
    <div className={`celebration celebration--${type}`} role="status" aria-live="polite">
      <div className="celebration__particles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} style={{ '--particle-index': index } as CSSProperties}>
            {index % 3 === 0 ? '♥' : index % 3 === 1 ? '✦' : '·'}
          </span>
        ))}
      </div>
      <div className="celebration__message">
        <strong aria-hidden="true">{copy.symbol}</strong>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>
    </div>
  )
}

export type { CelebrationType }
