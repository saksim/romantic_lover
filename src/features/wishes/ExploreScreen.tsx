import { useEffect, useMemo, useState } from 'react'
import { CategoryTabs, type CategoryFilter } from '../../components/CategoryTabs'
import { WishCard } from '../../components/WishCard'
import type { Category, CategoryId, CoupleProfile, Wish, WishProgressMap } from '../../domain/wish'

interface ExploreScreenProps {
  wishes: Wish[]
  categories: Category[]
  categoryMap: Record<CategoryId, Category>
  profile: CoupleProfile
  progress: WishProgressMap
  savedCount: number
  completedCount: number
  onToggleSaved: (wishId: string) => void
  onComplete: (wish: Wish) => void
  onViewed: (wishId: string) => void
  onAddWish: () => void
  onOpenCollection: () => void
  onCelebrateSave: () => void
  onNotify: (message: string) => void
}

export function ExploreScreen({ wishes, categories, categoryMap, profile, progress, savedCount, completedCount,
  onToggleSaved, onComplete, onViewed, onAddWish, onOpenCollection, onCelebrateSave, onNotify }: ExploreScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const filteredWishes = useMemo(() => selectedCategory === 'all'
    ? wishes
    : wishes.filter((wish) => wish.category === selectedCategory), [selectedCategory, wishes])

  useEffect(() => setCurrentIndex(0), [selectedCategory])
  const safeIndex = filteredWishes.length ? currentIndex % filteredWishes.length : 0
  const currentWish = filteredWishes[safeIndex]

  useEffect(() => {
    if (currentWish) onViewed(currentWish.id)
  }, [currentWish, onViewed])

  if (!currentWish) return null

  const previous = () => setCurrentIndex((index) => (index - 1 + filteredWishes.length) % filteredWishes.length)
  const next = () => setCurrentIndex((index) => (index + 1) % filteredWishes.length)
  const random = () => {
    if (filteredWishes.length < 2) return
    setCurrentIndex((index) => (index + 1 + Math.floor(Math.random() * (filteredWishes.length - 1))) % filteredWishes.length)
  }
  const toggleSaved = () => {
    const wasSaved = Boolean(progress[currentWish.id]?.saved)
    onToggleSaved(currentWish.id)
    if (!wasSaved) onCelebrateSave()
    onNotify(wasSaved ? '已从我们的愿望里移除' : '已经替未来的我们收好了')
  }
  const creatorLabel = currentWish.createdBy === 'partner' ? profile.partnerName : profile.myName

  return (
    <section className="explore-screen" aria-labelledby="explore-title">
      <div className="screen-intro">
        <div><p className="section-kicker">OUR NEXT LITTLE THING</p><h1 id="explore-title">今天，想和你做什么？</h1></div>
        <button type="button" className="add-wish-button" onClick={onAddWish}><span aria-hidden="true">＋</span>写愿望</button>
      </div>
      <div className="explore-stats"><span><strong>{savedCount}</strong> 个期待</span><i /><span><strong>{completedCount}</strong> 段回忆</span><i /><span><strong>{wishes.length}</strong> 张卡</span></div>
      <button type="button" className="wish-list-link" onClick={onOpenCollection}><span aria-hidden="true">♥</span>查看我们收好的 {savedCount} 个愿望</button>
      <CategoryTabs categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
      <WishCard key={currentWish.id} wish={currentWish} category={categoryMap[currentWish.category]}
        progress={progress[currentWish.id]} position={safeIndex + 1} total={filteredWishes.length}
        creatorLabel={creatorLabel} onToggleSaved={toggleSaved} onComplete={() => onComplete(currentWish)}
        onPrevious={previous} onNext={next} onRandom={random} />
    </section>
  )
}
