import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ModalShell } from '../../components/ModalShell'
import type { CoupleProfile, Memory, MemoryKind, TimeCapsule } from '../../domain/wish'
import { daysUntil, formatChineseDate } from '../../utils/date'

type StoryView = 'timeline' | 'universe' | 'museum'

interface StoryScreenProps {
  memories: Memory[]
  capsules: TimeCapsule[]
  profile: CoupleProfile
  focusMemoryId?: string
  onFocusHandled: () => void
  onAddMemory: () => void
  onEditMemory: (memory: Memory) => void
  onDeleteMemory: (memoryId: string) => void
  onNotify: (message: string) => void
}

const kindMeta: Record<MemoryKind, { symbol: string; label: string; color: string }> = {
  milestone: { symbol: '✦', label: '重要时刻', color: '#d8b36a' },
  date: { symbol: '♥', label: '约会心动', color: '#e78b9c' },
  trip: { symbol: '↗', label: '旅行足迹', color: '#75a7a2' },
  gift: { symbol: '◇', label: '礼物珍藏', color: '#b59ada' },
  ordinary: { symbol: '○', label: '普通日常', color: '#e4c5b4' },
  conversation: { symbol: '“”', label: '一句真心', color: '#9ba8da' },
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function creatorLabel(memory: Memory, profile: CoupleProfile) {
  if (memory.createdBy === 'me') return profile.myName
  if (memory.createdBy === 'partner') return profile.partnerName
  return '我们共同'
}

function buildStarMap(memories: Memory[]) {
  return memories.slice(0, 48).map((memory, index) => {
    const hash = hashText(memory.id)
    const columns = 4
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = 13 + column * 24 + ((hash % 11) - 5)
    const y = 9 + row * 92 + ((hash >>> 8) % 31)
    const size = memory.featured ? 30 : 15 + ((hash >>> 16) % 9)
    return { memory, x, y, size, delay: -((hash % 24) / 10) }
  })
}

export function StoryScreen({ memories, capsules, profile, focusMemoryId, onFocusHandled, onAddMemory, onEditMemory,
  onDeleteMemory, onNotify }: StoryScreenProps) {
  const [view, setView] = useState<StoryView>('timeline')
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null)
  const sortedMemories = useMemo(
    () => [...memories].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
    [memories],
  )
  const starMap = useMemo(() => buildStarMap(sortedMemories), [sortedMemories])
  const featured = useMemo(() => {
    const selected = [...memories]
      .filter((memory) => memory.featured)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    return (selected.length ? selected : [...memories].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))).slice(0, 12)
  }, [memories])
  const futureCapsules = useMemo(
    () => [...capsules].sort((left, right) => left.openAt.localeCompare(right.openAt)),
    [capsules],
  )

  useEffect(() => {
    if (!focusMemoryId) return
    const memory = memories.find((item) => item.id === focusMemoryId)
    if (memory) {
      setView('timeline')
      setActiveMemory(memory)
      onFocusHandled()
    }
  }, [focusMemoryId, memories, onFocusHandled])

  const years = useMemo(() => {
    const values = memories.map((memory) => Number(memory.occurredAt.slice(0, 4))).filter(Number.isFinite)
    if (profile.anniversaryDate) values.push(Number(profile.anniversaryDate.slice(0, 4)))
    if (!values.length) return 0
    return Math.max(1, new Date().getFullYear() - Math.min(...values) + 1)
  }, [memories, profile.anniversaryDate])

  const removeMemory = (memory: Memory) => {
    if (!window.confirm(`确定删除“${memory.title}”吗？这段故事会从时间轴、星空和展馆同时消失。`)) return
    onDeleteMemory(memory.id)
    setActiveMemory(null)
    onNotify('这段回忆已经从故事宇宙移除')
  }

  const openEditor = (memory: Memory) => {
    setActiveMemory(null)
    onEditMemory(memory)
  }

  const universeHeight = Math.max(470, Math.ceil(starMap.length / 4) * 112 + 80)
  const tabs: Array<{ id: StoryView; symbol: string; label: string }> = [
    { id: 'timeline', symbol: '⌇', label: '时间轴' },
    { id: 'universe', symbol: '✦', label: '我们的宇宙' },
    { id: 'museum', symbol: '▣', label: '恋爱博物馆' },
  ]

  return (
    <section className="story-screen" aria-labelledby="story-title">
      <div className="story-heading">
        <div>
          <p className="section-kicker">OUR STORY UNIVERSE</p>
          <h1 id="story-title">我们走过的，都在这里发光</h1>
          <p>一段记忆，只收藏一次；在时间、星空和展馆里，用三种方式再次遇见。</p>
        </div>
        <button type="button" className="round-add-button" onClick={onAddMemory} aria-label="添加回忆">＋</button>
      </div>

      <div className="story-summary" aria-label="故事宇宙摘要">
        <span><strong>{memories.length}</strong><small>段故事</small></span>
        <span><strong>{memories.filter((memory) => memory.media.length).length}</strong><small>件影像</small></span>
        <span><strong>{memories.filter((memory) => memory.featured).length}</strong><small>颗主星</small></span>
        <span><strong>{years || '∞'}</strong><small>{years ? '年光阴' : '等待开始'}</small></span>
      </div>

      <div className="story-tabs" role="tablist" aria-label="故事观看方式">
        {tabs.map((tab) => (
          <button type="button" role="tab" aria-selected={view === tab.id}
            className={view === tab.id ? 'is-active' : ''} onClick={() => setView(tab.id)} key={tab.id}>
            <span aria-hidden="true">{tab.symbol}</span>{tab.label}
          </button>
        ))}
      </div>

      {view === 'timeline' && (
        <div className="story-timeline" role="tabpanel" aria-label="爱情时间轴">
          {profile.anniversaryDate && (
            <article className="timeline-origin">
              <span aria-hidden="true">∞</span>
              <div><small>OUR STORY BEGAN</small><h2>故事从这里开始</h2><p>{formatChineseDate(profile.anniversaryDate)}</p></div>
            </article>
          )}

          {sortedMemories.length ? sortedMemories.map((memory, index) => {
            const meta = kindMeta[memory.kind]
            return (
              <article className={`timeline-memory${memory.featured ? ' is-featured' : ''}`} key={memory.id}>
                <div className="timeline-memory__rail">
                  <span style={{ '--memory-color': meta.color } as CSSProperties}>{meta.symbol}</span>
                  {index < sortedMemories.length - 1 && <i />}
                </div>
                <button type="button" className="timeline-memory__card" onClick={() => setActiveMemory(memory)}>
                  {memory.media[0] && <img src={memory.media[0].dataUrl} alt={memory.media[0].alt} />}
                  <div className="timeline-memory__copy">
                    <div><small>{formatChineseDate(memory.occurredAt)}</small><em>{meta.label}</em></div>
                    <h2>{memory.title}</h2>
                    <p>{memory.story}</p>
                    <span>{memory.location ? `⌖ ${memory.location}` : creatorLabel(memory, profile)}<i aria-hidden="true">→</i></span>
                  </div>
                </button>
              </article>
            )
          }) : (
            <div className="story-empty">
              <span aria-hidden="true">✦</span>
              <h2>宇宙还在等待第一颗星</h2>
              <p>可以手动收藏过去的故事；以后完成愿望时，也会自动点亮一段回忆。</p>
              <button type="button" className="primary-button" onClick={onAddMemory}>收藏第一段回忆</button>
            </div>
          )}

          <div className="timeline-now"><span>♥</span><div><small>RIGHT HERE, RIGHT NOW</small><strong>此刻的我们</strong></div></div>

          {futureCapsules.map((capsule) => {
            const remaining = daysUntil(capsule.openAt)
            return (
              <article className="timeline-future" key={capsule.id}>
                <span aria-hidden="true">{capsule.openedAt || remaining === 0 ? '✉' : '◇'}</span>
                <div><small>LETTER TO THE FUTURE</small><h2>{capsule.title}</h2>
                  <p>{capsule.openedAt ? `已于 ${formatChineseDate(capsule.openedAt)} 打开` : remaining === 0 ? '今天可以打开' : `${remaining} 天后可以打开`}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {view === 'universe' && (
        <div className="universe-panel" role="tabpanel" aria-label="我们的回忆星空">
          {starMap.length ? (
            <>
              <div className="universe-copy">
                <p className="section-kicker">EVERY MEMORY BECOMES A STAR</p>
                <h2>{profile.myName} & {profile.partnerName} 的宇宙</h2>
                <p>大星星是你们亲自珍藏的展品。轻轻点亮一颗，就能回到那一天。</p>
              </div>
              <div className="universe-canvas" style={{ height: universeHeight }}>
                <div className="universe-nebula universe-nebula--one" /><div className="universe-nebula universe-nebula--two" />
                <svg className="constellation-lines" width="100%" height={universeHeight} aria-hidden="true">
                  {starMap.slice(1).map((star, index) => {
                    const previous = starMap[index]
                    return <line x1={`${previous.x}%`} y1={previous.y} x2={`${star.x}%`} y2={star.y} key={star.memory.id} />
                  })}
                </svg>
                {starMap.map((star) => {
                  const meta = kindMeta[star.memory.kind]
                  const style = {
                    '--star-x': `${star.x}%`,
                    '--star-y': `${star.y}px`,
                    '--star-size': `${star.size}px`,
                    '--star-color': meta.color,
                    '--star-delay': `${star.delay}s`,
                  } as CSSProperties
                  return (
                    <button type="button" className={`memory-star${star.memory.featured ? ' is-featured' : ''}`}
                      style={style} onClick={() => setActiveMemory(star.memory)}
                      aria-label={`打开回忆：${star.memory.title}，${formatChineseDate(star.memory.occurredAt)}`} key={star.memory.id}>
                      <span aria-hidden="true">✦</span><small>{star.memory.title}</small>
                    </button>
                  )
                })}
              </div>
              {memories.length > 48 && <p className="universe-limit-note">星空先展示最近点亮的 48 颗星，其余故事仍保留在时间轴中。</p>}
            </>
          ) : <div className="story-empty story-empty--dark"><span>✦</span><h2>第一颗星还没有升起</h2><p>写下一段故事，宇宙就会拥有自己的光。</p><button type="button" className="light-button" onClick={onAddMemory}>点亮第一颗星</button></div>}
        </div>
      )}

      {view === 'museum' && (
        <div className="museum-panel" role="tabpanel" aria-label="恋爱博物馆">
          <div className="museum-marquee">
            <small>PRIVATE EXHIBITION · V0.4</small>
            <h2>只为两个人开放的展览</h2>
            <p>{featured.some((memory) => memory.featured) ? '这里陈列着你们亲自选中的珍藏展品。' : '还没有指定展品，暂时为你们展出最近的故事。'}</p>
          </div>
          {featured.length ? (
            <div className="museum-corridor">
              {featured.map((memory, index) => {
                const meta = kindMeta[memory.kind]
                return (
                  <button type="button" className="museum-exhibit" onClick={() => setActiveMemory(memory)} key={memory.id}>
                    <span className="museum-exhibit__number">{String(index + 1).padStart(2, '0')}</span>
                    <span className={`museum-frame${memory.media[0] ? ' has-image' : ''}`}>
                      {memory.media[0] ? <img src={memory.media[0].dataUrl} alt={memory.media[0].alt} />
                        : <i style={{ '--memory-color': meta.color } as CSSProperties}>{meta.symbol}</i>}
                    </span>
                    <span className="museum-plaque"><small>{meta.label} · {formatChineseDate(memory.occurredAt)}</small><strong>{memory.title}</strong><em>{memory.story}</em></span>
                  </button>
                )
              })}
            </div>
          ) : <div className="story-empty"><span>▣</span><h2>展厅还没有第一件展品</h2><p>收藏一段回忆并设为“珍藏展品”，它就会被挂进这里。</p><button type="button" className="primary-button" onClick={onAddMemory}>添加第一件展品</button></div>}
          <div className="museum-exit"><span aria-hidden="true">∞</span><p>展览没有真正的出口，因为故事仍在继续。</p></div>
        </div>
      )}

      {activeMemory && (
        <ModalShell title={activeMemory.title} eyebrow="A PIECE OF OUR STORY" onClose={() => setActiveMemory(null)} size="large">
          <article className="memory-detail">
            {activeMemory.media[0] && <img className="memory-detail__photo" src={activeMemory.media[0].dataUrl} alt={activeMemory.media[0].alt} />}
            <div className="memory-detail__meta">
              <span>{kindMeta[activeMemory.kind].symbol} {kindMeta[activeMemory.kind].label}</span>
              <span>{formatChineseDate(activeMemory.occurredAt)}</span>
            </div>
            {activeMemory.location && <p className="memory-detail__location">⌖ {activeMemory.location}</p>}
            <blockquote>{activeMemory.story}</blockquote>
            <p className="memory-detail__by">由 {creatorLabel(activeMemory, profile)} 收藏{activeMemory.featured ? ' · 博物馆珍藏展品' : ''}</p>
            {activeMemory.tags.length > 0 && <div className="memory-detail__tags">{activeMemory.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            {activeMemory.linkedWishId && <p className="memory-detail__origin">✦ 来自一个已经实现的愿望</p>}
            <div className={`memory-detail__actions${activeMemory.linkedWishId ? ' is-linked' : ''}`}>
              {!activeMemory.linkedWishId && <button type="button" className="secondary-button" onClick={() => removeMemory(activeMemory)}>删除</button>}
              <button type="button" className="primary-button" onClick={() => openEditor(activeMemory)}>编辑这段故事</button>
            </div>
          </article>
        </ModalShell>
      )}
    </section>
  )
}
