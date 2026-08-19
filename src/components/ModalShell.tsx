import { useEffect, type ReactNode } from 'react'

interface ModalShellProps {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  size?: 'normal' | 'large'
}

export function ModalShell({ title, eyebrow, children, onClose, size = 'normal' }: ModalShellProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`modal-card modal-card--${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-card__header">
          <div>
            {eyebrow && <p className="section-kicker">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </section>
    </div>
  )
}

