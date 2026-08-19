import { useMemo, useState, type CSSProperties } from 'react'
import { ProgressBar } from '../../components/ProgressBar'
import type { Category, CategoryId, Memory, Wish, WishProgressMap } from '../../domain/wish'
import { formatChineseDate } from '../../utils/date'

type CollectionTab = 'saved' | 'completed'
type CollectionFilter = 'all' | CategoryId | 'custom'

interface CollectionScreenProps {
  wishes: Wish[]
  categories: Category[]
  categoryMap: Record<CategoryId, Category>
  progress: WishProgressMap
  memories: Memory[]
  savedCount: number
  completedCount: number
  selectedCount: number
  secretUnlocked: boolean
  secretOpenedAt?: string
  onToggleSaved: (wishId: string) => void
  onComplete: (wish: Wish) => void
  onUndoCompletion: (wishId: string) => void
  onDeleteCustomWish: (wishId: string) => void
  onOpenSecret: () => void
  onExplore: () => void
  onAddWish: () => void
  onNotify: (message: string) => void
}

export function CollectionScreen({ wishes, categories, categoryMap, progress, memories, savedCount, completedCount, selectedCount,
  secretUnlocked, secretOpenedAt, onToggleSaved, onComplete, onUndoCompletion, onDeleteCustomWish, onOpenSecret,
  onExplore, onAddWish, onNotify }: CollectionScreenProps) {
  const [tab, setTab] = useState<CollectionTab>('saved')
  const [filter, setFilter] = useState<CollectionFilter>('all')
  const visibleWishes = useMemo(() => wishes.filter((wish) => {
    const entry = progress[wish.id]
    const statusMatches = tab === 'completed' ? Boolean(entry?.completed) : Boolean(entry?.saved && !entry.completed)
    const filterMatches = filter === 'all' || (filter === 'custom' ? Boolean(wish.source && wish.source !== 'curated') : wish.category === filter)
    return statusMatches && filterMatches
  }), [filter, progress, tab, wishes])
  const memoriesByWishId = useMemo(
    () => new Map(memories.filter((memory) => memory.linkedWishId).map((memory) => [memory.linkedWishId as string, memory])),
    [memories],
  )
  const remainingForSecret = Math.max(0, 3 - selectedCount)

  const removeCustom = (wish: Wish) => {
    if (!window.confirm(`确定删除“${wish.title}”吗？这台设备上的相关记录也会一起删除。`)) return
    onDeleteCustomWish(wish.id)
    onNotify('这个自定义愿望已经移除')
  }

  return (
    <section className="collection-screen" aria-labelledby="collection-title">
      <div className="collection-heading collection-heading--with-action">
        <div><p className="section-kicker">OUR FUTURE, OUR MEMORIES</p><h1 id="collection-title">收藏与回忆</h1><p>想做的事在这里等待，做到的事在这里慢慢长成故事。</p></div>
        <button type="button" className="round-add-button" onClick={onAddWish} aria-label="添加愿望">＋</button>
      </div>

      <div className="collection-summary">
        <div className="summary-numbers">
          <div><strong>{savedCount}</strong><span>留给未来</span></div>
          <div><strong>{completedCount}</strong><span>成为回忆</span></div>
          <div><strong>{Math.max(0, wishes.length - completedCount)}</strong><span>还在路上</span></div>
        </div>
        <ProgressBar value={completedCount} max={wishes.length} label="我们的完成进度" />
      </div>

      <div className="collection-tabs" role="tablist" aria-label="收藏分类">
        <button type="button" role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'is-active' : ''} onClick={() => setTab('saved')}>想一起做</button>
        <button type="button" role="tab" aria-selected={tab === 'completed'} className={tab === 'completed' ? 'is-active' : ''} onClick={() => setTab('completed')}>回忆相册</button>
      </div>

      <div className="collection-filters" role="group" aria-label="筛选收藏">
        <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>全部</button>
        <button type="button" className={filter === 'custom' ? 'is-active' : ''} onClick={() => setFilter('custom')}>我们写的</button>
        {categories.map((category) => <button type="button" className={filter === category.id ? 'is-active' : ''}
          onClick={() => setFilter(category.id)} key={category.id}>{category.shortName}</button>)}
      </div>

      {visibleWishes.length > 0 ? (
        <div className={`collection-list${tab === 'completed' ? ' collection-list--memories' : ''}`}>
          {visibleWishes.map((wish) => {
            const category = categoryMap[wish.category]
            const entry = progress[wish.id]
            const memory = memoriesByWishId.get(wish.id)
            const photoDataUrl = memory?.media[0]?.dataUrl ?? entry.photoDataUrl
            const memoryNote = memory?.story ?? entry.note
            const completedAt = memory?.occurredAt ?? entry.completedAt
            const custom = Boolean(wish.source && wish.source !== 'curated')
            const style = { '--category-color': category.color, '--category-soft': category.softColor } as CSSProperties
            return (
              <article className={`collection-card${entry.completed ? ' collection-card--memory' : ''}${photoDataUrl ? ' has-photo' : ''}`} style={style} key={wish.id}>
                {photoDataUrl && <div className="memory-photo"><img src={photoDataUrl} alt={`${wish.title}的回忆照片`} /></div>}
                <div className="collection-card__symbol" aria-hidden="true">{entry.completed ? '✓' : category.symbol}</div>
                <div className="collection-card__content">
                  <div className="collection-card__meta"><span>{custom ? '我们写下的愿望' : category.name}</span><span>{custom ? '#OURS' : `#${String(wish.number).padStart(2, '0')}`}</span></div>
                  <h2>{wish.title}</h2>
                  {entry.completed ? (
                    <>
                      <p className="completed-date">✦ {formatChineseDate(completedAt)}</p>
                      {memoryNote && <p className="memory-note">“{memoryNote}”</p>}
                    </>
                  ) : wish.plannedFor ? <p className="planned-date">计划在 {formatChineseDate(wish.plannedFor)}</p> : null}
                  <div className="collection-card__actions">
                    {entry.completed ? (
                      <>
                        <button type="button" onClick={() => { onUndoCompletion(wish.id); onNotify('已恢复到想一起做') }}>恢复待做</button>
                        <button type="button" className="collection-card__complete" onClick={() => onComplete(wish)}>查看 / 编辑回忆</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => { onToggleSaved(wish.id); onNotify('已从收藏中移除') }}>移除</button>
                        <button type="button" className="collection-card__complete" onClick={() => onComplete(wish)}>我们做到了</button>
                      </>
                    )}
                    {custom && <button type="button" className="danger-link" onClick={() => removeCustom(wish)}>删除</button>}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">{tab === 'saved' ? '♡' : '○'}</span>
          <h2>{tab === 'saved' ? '这里还等着第一份心动' : '这一页回忆还在路上'}</h2>
          <p>{filter !== 'all' ? '换一个分类看看，或者亲手写下新的愿望。' : tab === 'saved' ? '遇见喜欢的愿望时，把它留给未来的我们。' : '完成愿望时可以保存日期、文字和一张照片。'}</p>
          <div className="empty-state__actions"><button type="button" className="secondary-button" onClick={onExplore}>去遇见愿望</button><button type="button" className="primary-button" onClick={onAddWish}>写一个愿望</button></div>
        </div>
      )}

      <aside className={`secret-teaser${secretUnlocked ? ' is-unlocked' : ''}`}>
        <div className="secret-teaser__mark" aria-hidden="true">∞</div>
        <div className="secret-teaser__copy"><p className="section-kicker">THE HIDDEN WISH</p><h2>#∞ · 没有尽头的那一张</h2>
          <p>{secretUnlocked ? (secretOpenedAt ? '你已经拆开过它，但它永远值得再看一次。' : '共同愿望已经让这封隐藏来信出现。') : `再留下 ${remainingForSecret} 个愿望，这张没有编号的卡就会出现。`}</p>
        </div>
        {secretUnlocked ? <button type="button" className="secret-button" onClick={onOpenSecret}>{secretOpenedAt ? '再看一次' : '打开秘密'}<span aria-hidden="true">→</span></button>
          : <div className="secret-dots" aria-label={`隐藏愿望解锁进度 ${selectedCount} / 3`}>{[0, 1, 2].map((index) => <span className={index < selectedCount ? 'is-filled' : ''} key={index} />)}</div>}
      </aside>
    </section>
  )
}
