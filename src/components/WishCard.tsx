import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { Category, Wish, WishProgress } from '../domain/wish'

interface WishCardProps {
  wish: Wish
  category: Category
  progress?: WishProgress
  position: number
  total: number
  creatorLabel?: string
  onToggleSaved: () => void
  onComplete: () => void
  onPrevious: () => void
  onNext: () => void
  onRandom: () => void
}

const durationLabels = { quick: '30 分钟', evening: '一个晚上', day: '半天以上' }
const settingLabels = { home: '宅家', out: '出门', either: '都可以' }

export function WishCard({ wish, category, progress, position, total, creatorLabel, onToggleSaved, onComplete,
  onPrevious, onNext, onRandom }: WishCardProps) {
  const pointerStartX = useRef<number | null>(null)
  const saved = Boolean(progress?.saved)
  const completed = Boolean(progress?.completed)
  const custom = wish.source === 'custom' || wish.source === 'date-idea'
  const style = { '--category-color': category.color, '--category-soft': category.softColor } as CSSProperties

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    pointerStartX.current = event.clientX
  }
  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerStartX.current === null) return
    const distance = event.clientX - pointerStartX.current
    pointerStartX.current = null
    if (Math.abs(distance) < 56) return
    if (distance > 0) onPrevious()
    else onNext()
  }

  return (
    <div className="wish-stage">
      <article className={`wish-card${saved ? ' is-saved' : ''}${completed ? ' is-completed' : ''}${custom ? ' is-custom' : ''}`}
        style={style} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerStartX.current = null }}>
        <div className="wish-card__shine" aria-hidden="true" />
        <div className="wish-card__halo" aria-hidden="true"><span>{category.symbol}</span></div>
        <div className="wish-card__meta">
          <span className="wish-card__category">{custom ? `${creatorLabel ?? '我们'}写下的愿望` : category.name}</span>
          <span className="wish-card__number">{custom ? '#OURS' : `#${String(wish.number).padStart(2, '0')}`}</span>
        </div>
        <div className="wish-card__body">
          <p className="wish-card__eyebrow">{custom ? 'Written by us' : category.eyebrow}</p>
          <h2>{wish.title}</h2>
          <p className="wish-card__description">{wish.description}</p>
          <p className="wish-card__moment">“{wish.moment}”</p>
          {(wish.duration || wish.setting || wish.plannedFor) && (
            <div className="wish-card__plan">
              {wish.duration && <span>{durationLabels[wish.duration]}</span>}
              {wish.setting && <span>{settingLabels[wish.setting]}</span>}
              {wish.plannedFor && <span>计划 {wish.plannedFor}</span>}
            </div>
          )}
        </div>
        <div className="wish-card__actions">
          <button type="button" className={`action-button action-button--save${saved ? ' is-active' : ''}`}
            aria-pressed={saved} onClick={onToggleSaved}>
            <span aria-hidden="true">{saved ? '♥' : '♡'}</span>{saved ? '已留给我们' : '留给我们'}
          </button>
          <button type="button" className={`action-button action-button--complete${completed ? ' is-active' : ''}`}
            aria-pressed={completed} onClick={onComplete}>
            <span aria-hidden="true">{completed ? '✦' : '○'}</span>{completed ? '打开这段回忆' : '我们做到了'}
          </button>
        </div>
      </article>
      <div className="card-controls" aria-label="愿望卡片导航">
        <button type="button" className="icon-button" onClick={onPrevious} aria-label="上一张愿望">←</button>
        <button type="button" className="surprise-button" onClick={onRandom}><span aria-hidden="true">✦</span>随机遇见</button>
        <button type="button" className="icon-button" onClick={onNext} aria-label="下一张愿望">→</button>
      </div>
      <p className="card-position" aria-live="polite">{position} / {total} · 左右滑动也可以换一张</p>
    </div>
  )
}
