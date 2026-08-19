import { useEffect, useMemo, useRef, useState } from 'react'
import type { DateDuration, DateIdea, DateSetting } from '../domain/wish'
import { ModalShell } from './ModalShell'

interface DateRouletteModalProps {
  ideas: DateIdea[]
  onKeep: (idea: DateIdea) => void
  onClose: () => void
}

const durationCopy = { all: '不限', quick: '30 分钟', evening: '一个晚上', day: '半天以上' } as const
const settingCopy = { all: '随缘', home: '想宅家', out: '想出门', either: '都可以' } as const

export function DateRouletteModal({ ideas, onKeep, onClose }: DateRouletteModalProps) {
  const [duration, setDuration] = useState<'all' | DateDuration>('all')
  const [setting, setSetting] = useState<'all' | DateSetting>('all')
  const [result, setResult] = useState<DateIdea | null>(null)
  const [spinning, setSpinning] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const candidates = useMemo(() => ideas.filter((idea) =>
    (duration === 'all' || idea.duration === duration) &&
    (setting === 'all' || idea.setting === setting || idea.setting === 'either')),
  [duration, ideas, setting])

  const spin = () => {
    const pool = candidates.length ? candidates : ideas
    setSpinning(true)
    setResult(null)
    timer.current = window.setTimeout(() => {
      setResult(pool[Math.floor(Math.random() * pool.length)])
      setSpinning(false)
    }, 900)
  }

  return (
    <ModalShell title="今晚，让命运替我们选" eyebrow="DATE NIGHT ROULETTE" onClose={onClose}>
      <div className="roulette-filters">
        <fieldset className="form-field">
          <legend>有多少时间？</legend>
          <div className="choice-grid choice-grid--four">
            {(Object.entries(durationCopy) as Array<[keyof typeof durationCopy, string]>).map(([value, label]) => (
              <button type="button" className={duration === value ? 'is-selected' : ''} onClick={() => setDuration(value)} key={value}>{label}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="form-field">
          <legend>今天想去哪？</legend>
          <div className="choice-grid choice-grid--four">
            {(Object.entries(settingCopy) as Array<[keyof typeof settingCopy, string]>).map(([value, label]) => (
              <button type="button" className={setting === value ? 'is-selected' : ''} onClick={() => setSetting(value)} key={value}>{label}</button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={`roulette-stage${spinning ? ' is-spinning' : ''}${result ? ' has-result' : ''}`}>
        {spinning ? (
          <div className="roulette-spinner" aria-live="polite"><span>♥</span><strong>正在问今晚的运气…</strong></div>
        ) : result ? (
          <article className="roulette-result" aria-live="polite">
            <p className="section-kicker">TONIGHT'S LITTLE ADVENTURE</p>
            <span className="roulette-result__symbol" aria-hidden="true">✦</span>
            <h3>{result.title}</h3>
            <p>{result.description}</p>
            <blockquote>“{result.moment}”</blockquote>
            <div className="roulette-result__tags">
              <span>{durationCopy[result.duration]}</span><span>{settingCopy[result.setting]}</span>
            </div>
          </article>
        ) : (
          <div className="roulette-empty"><span aria-hidden="true">∞</span><p>{candidates.length} 个适合此刻的约会点子，正等着被抽中。</p></div>
        )}
      </div>

      <div className="roulette-actions">
        <button type="button" className="secondary-button" onClick={spin} disabled={spinning}>{result ? '再换一个' : '开始抽取'}</button>
        {result && <button type="button" className="primary-button" onClick={() => onKeep(result)}>
          {result.id.startsWith('wish:') ? '它已经在愿望里' : '留进我们的愿望'}
        </button>}
      </div>
    </ModalShell>
  )
}
