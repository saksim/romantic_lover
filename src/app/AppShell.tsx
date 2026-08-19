import type { ReactNode } from 'react'
import { BottomNav } from '../components/BottomNav'
import { LogoMark } from '../components/LogoMark'
import { RomanceAtmosphere } from '../components/RomanceEffects'
import type { AppView } from '../domain/wish'

interface AppShellProps {
  view: AppView
  completedCount: number
  romanceEffects: boolean
  children: ReactNode
  onNavigate: (view: AppView) => void
}

export function AppShell({ view, completedCount, romanceEffects, children, onNavigate }: AppShellProps) {
  const showChrome = !['opening', 'secret'].includes(view)
  return (
    <div className={`app-root app-root--${view}`}>
      <RomanceAtmosphere enabled={romanceEffects && showChrome} />
      <div className="ambient ambient--one" aria-hidden="true" /><div className="ambient ambient--two" aria-hidden="true" />
      <div className={`app-frame${showChrome ? '' : ' app-frame--full'}`}>
        {showChrome && <header className="app-header">
          <button type="button" className="brand-button" onClick={() => onNavigate('opening')}>
            <LogoMark compact /><span><strong>Future With You</strong><small>for our unwritten days</small></span>
          </button>
          <div className="header-progress" aria-label={`已经完成 ${completedCount} 个愿望`}><strong>{completedCount}</strong><span>MEMORIES</span></div>
        </header>}
        <main className={`app-content${showChrome ? '' : ' app-content--full'}`}>{children}</main>
        {showChrome && <BottomNav activeView={view} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

