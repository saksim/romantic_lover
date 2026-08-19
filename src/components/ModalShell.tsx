import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalShellProps {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  size?: 'normal' | 'large'
}

export function ModalShell({ title, eyebrow, children, onClose, size = 'normal' }: ModalShellProps) {
  const titleId = useId()
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

  return createPortal(
    <div className="modal-overlay" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`modal-card modal-card--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-card__header">
          <div>
            {eyebrow && <p className="section-kicker">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}

