import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getDailyQuestion, getDateKey } from '../../data/dailyQuestions'
import type { AppView, CoupleProfile, DailyAnswer, Memory } from '../../domain/wish'
import { formatChineseDate } from '../../utils/date'

interface HomeScreenProps {
  profile: CoupleProfile
  dailyAnswer?: DailyAnswer
  onThisDayMemory?: Memory
  savedCount: number
  completedCount: number
  customCount: number
  daysTogether: number | null
  onSaveDailyAnswer: (answer: Omit<DailyAnswer, 'updatedAt'>) => void
  onOpenRoulette: () => void
  onOpenAddWish: () => void
  onOpenMemory: (memoryId: string) => void
  onNavigate: (view: AppView) => void
  onNotify: (message: string) => void
}

export function HomeScreen({ profile, dailyAnswer, onThisDayMemory, savedCount, completedCount, customCount, daysTogether,
  onSaveDailyAnswer, onOpenRoulette, onOpenAddWish, onOpenMemory, onNavigate, onNotify }: HomeScreenProps) {
  const question = useMemo(() => getDailyQuestion(), [])
  const dateKey = useMemo(() => getDateKey(), [])
  const [myAnswer, setMyAnswer] = useState(dailyAnswer?.myAnswer ?? '')
  const [partnerAnswer, setPartnerAnswer] = useState(dailyAnswer?.partnerAnswer ?? '')

  useEffect(() => {
    setMyAnswer(dailyAnswer?.myAnswer ?? '')
    setPartnerAnswer(dailyAnswer?.partnerAnswer ?? '')
  }, [dailyAnswer])

  const dateLabel = useMemo(() => new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date()), [])

  const saveAnswers = (event: FormEvent) => {
    event.preventDefault()
    onSaveDailyAnswer({ questionId: question.id, dateKey, myAnswer: myAnswer.trim(), partnerAnswer: partnerAnswer.trim() })
    onNotify('今天的两份心意，已经替你们收好了')
  }

  return (
    <section className="today-screen" aria-labelledby="today-title">
      <div className="today-date"><span>{dateLabel}</span><span>DAY BY DAY, WITH YOU</span></div>

      <div className="today-hero">
        <div className="today-hero__orb" aria-hidden="true"><span>♥</span><i /></div>
        <p className="section-kicker">GOOD TO SEE YOU BOTH</p>
        <h1 id="today-title">{profile.myName} & {profile.partnerName}</h1>
        <p>{profile.greeting}</p>
        <div className="today-hero__stats">
          <div><strong>{daysTogether ?? '∞'}</strong><span>{daysTogether ? '一起走过的天数' : '等待填写纪念日'}</span></div>
          <div><strong>{completedCount}</strong><span>已经点亮的回忆</span></div>
        </div>
      </div>
      {onThisDayMemory && (
        <button type="button" className="memory-of-day" onClick={() => onOpenMemory(onThisDayMemory.id)}>
          {onThisDayMemory.media[0] && <img src={onThisDayMemory.media[0].dataUrl} alt={onThisDayMemory.media[0].alt} />}
          <span className="memory-of-day__symbol" aria-hidden="true">✦</span>
          <span className="memory-of-day__copy">
            <small>ON THIS DAY · 那年今日</small>
            <strong>{onThisDayMemory.title}</strong>
            <em>{formatChineseDate(onThisDayMemory.occurredAt)}，这段故事曾经发生。</em>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      )}

      <button type="button" className="date-night-card" onClick={onOpenRoulette}>
        <div className="date-night-card__art" aria-hidden="true"><span>✦</span><i /><i /></div>
        <div className="date-night-card__copy">
          <p className="section-kicker">TONIGHT, LET FATE DECIDE</p>
          <h2>今晚做什么？</h2>
          <p>告诉我时间和心情，从 30+ 个约会点子与她写下的愿望里随机挑一个。</p>
        </div>
        <span className="date-night-card__arrow" aria-hidden="true">→</span>
      </button>

      <div className="quick-actions" aria-label="快捷功能">
        <button type="button" onClick={onOpenAddWish}><span aria-hidden="true">＋</span><strong>她来指定</strong><small>写一个新愿望</small></button>
        <button type="button" onClick={() => document.getElementById('daily-question')?.scrollIntoView({ behavior: 'smooth' })}>
          <span aria-hidden="true">?</span><strong>今日问题</strong><small>再懂彼此一点</small>
        </button>
        <button type="button" onClick={() => onNavigate('story')}><span aria-hidden="true">✦</span><strong>故事宇宙</strong><small>{completedCount} 个愿望已经成真</small></button>
        <button type="button" onClick={() => onNavigate('together')}><span aria-hidden="true">✉</span><strong>时间胶囊</strong><small>写给未来的信</small></button>
      </div>

      <section className="daily-question" id="daily-question" aria-labelledby="daily-question-title">
        <div className="daily-question__number" aria-hidden="true">{question.id.slice(1)}</div>
        <div className="daily-question__heading">
          <p className="section-kicker">ONE QUESTION A DAY</p>
          <h2 id="daily-question-title">今天，想问你们</h2>
        </div>
        <blockquote>{question.prompt}</blockquote>
        <p className="daily-question__hint">{question.hint}</p>
        <form className="daily-answer-form" onSubmit={saveAnswers}>
          <label><span>{profile.myName} 的答案</span><textarea maxLength={240} value={myAnswer} onChange={(event) => setMyAnswer(event.target.value)} placeholder="写下一点真实的想法…" /></label>
          <div className="answer-divider"><span>♥</span></div>
          <label><span>{profile.partnerName} 的答案</span><textarea maxLength={240} value={partnerAnswer} onChange={(event) => setPartnerAnswer(event.target.value)} placeholder="轮到她写下答案…" /></label>
          <button type="submit" className="primary-button" disabled={!myAnswer.trim() && !partnerAnswer.trim()}>
            {dailyAnswer ? '更新今天的答案' : '把今天的答案收好'}
          </button>
        </form>
      </section>

      <div className="today-footer-note">
        <span aria-hidden="true">∞</span>
        <p>已经有 <strong>{savedCount}</strong> 个期待、<strong>{customCount}</strong> 个你们亲手写下的愿望，在未来等着。</p>
      </div>
    </section>
  )
}

