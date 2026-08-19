import type { Category, CategoryId } from '../domain/wish'

export type CategoryFilter = 'all' | CategoryId

interface CategoryTabsProps {
  categories: Category[]
  selected: CategoryFilter
  onSelect: (category: CategoryFilter) => void
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="category-tabs" role="group" aria-label="按类别浏览愿望">
      <button type="button" className={`category-chip${selected === 'all' ? ' is-active' : ''}`}
        aria-pressed={selected === 'all'} onClick={() => onSelect('all')}>全部</button>
      {categories.map((category) => (
        <button type="button" className={`category-chip${selected === category.id ? ' is-active' : ''}`}
          aria-pressed={selected === category.id} onClick={() => onSelect(category.id)} key={category.id}>
          <span aria-hidden="true">{category.symbol}</span>{category.shortName}
        </button>
      ))}
    </div>
  )
}

