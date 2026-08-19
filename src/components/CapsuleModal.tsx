import { useMemo, useState, type FormEvent } from 'react'
import type { TimeCapsule } from '../domain/wish'
import { todayKey } from '../utils/date'
import { ModalShell } from './ModalShell'

interface CapsuleModalProps { onSave: (capsule: Pick<TimeCapsule, 'title' | 'message' | 'openAt'>) => void; onClose: () => void }

export function CapsuleModal({ onSave, onClose }: CapsuleModalProps) {
  const defaultDate = useMemo(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().slice(0, 10)
  }, [])
  const [title, setTitle] = useState('写给未来的我们')
  const [message, setMessage] = useState('')
  const [openAt, setOpenAt] = useState(defaultDate)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim() || !openAt) return
    onSave({ title: title.trim(), message: message.trim(), openAt })
  }
  return (
    <ModalShell title="封存一封未来来信" eyebrow="TIME CAPSULE" onClose={onClose} size="large">
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field"><span>信封上的名字</span><input autoFocus required maxLength={36} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="form-field"><span>想留给未来的话</span><textarea className="capsule-message-input" required maxLength={800} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="此刻的我们正在经历什么？希望未来的我们记住什么？" /></label>
        <label className="form-field"><span>哪一天可以打开？</span><input type="date" required min={todayKey()} value={openAt} onChange={(event) => setOpenAt(event.target.value)} /></label>
        <p className="form-note">封存以后，日期到来前正文会被藏起来。这里尊重你们的小仪式，不提供提前偷看。</p>
        <button type="submit" className="primary-button form-submit"><span>把这封信交给时间</span><span aria-hidden="true">✉</span></button>
      </form>
    </ModalShell>
  )
}

