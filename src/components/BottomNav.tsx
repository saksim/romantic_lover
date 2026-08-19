import type { AppView } from '../domain/wish'

interface BottomNavProps { activeView: AppView; onNavigate: (view: AppView) => void }

const items: Array<{ view: AppView; symbol: string; label: string }> = [
  { view: 'today', symbol: '☼', label: '今天' },
  { view: 'explore', symbol: '◇', label: '愿望' },
  { view: 'story', symbol: '✦', label: '故事' },
  { view: 'together', symbol: '∞', label: '我们' },
]

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主要页面">
      {items.map((item) => {
        const active = activeView === item.view ||
          (item.view === 'explore' && activeView === 'collection')
        return (
          <button type="button" className={`bottom-nav__item${active ? ' is-active' : ''}`} key={item.view}
            aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.view)}>
            <span className="bottom-nav__symbol" aria-hidden="true">{item.symbol}</span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

