import { useState, type FormEvent } from 'react'
import type { CoupleProfile } from '../domain/wish'
import { ModalShell } from './ModalShell'

interface ProfileModalProps { profile: CoupleProfile; onSave: (profile: CoupleProfile) => void; onClose: () => void }

export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [myName, setMyName] = useState(profile.myName)
  const [partnerName, setPartnerName] = useState(profile.partnerName)
  const [anniversaryDate, setAnniversaryDate] = useState(profile.anniversaryDate ?? '')
  const [greeting, setGreeting] = useState(profile.greeting)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!myName.trim() || !partnerName.trim()) return
    onSave({ myName: myName.trim(), partnerName: partnerName.trim(), anniversaryDate: anniversaryDate || undefined, greeting: greeting.trim() })
  }
  return (
    <ModalShell title="把这里变成我们的" eyebrow="PERSONALIZE OUR SPACE" onClose={onClose}>
      <form className="romance-form" onSubmit={submit}>
        <div className="form-columns form-columns--names">
          <label className="form-field"><span>你的名字</span><input required maxLength={16} autoFocus value={myName} onChange={(event) => setMyName(event.target.value)} /></label>
          <label className="form-field"><span>她的名字</span><input required maxLength={16} value={partnerName} onChange={(event) => setPartnerName(event.target.value)} /></label>
        </div>
        <label className="form-field"><span>你们故事开始的日期</span><input type="date" value={anniversaryDate} onChange={(event) => setAnniversaryDate(event.target.value)} /></label>
        <label className="form-field"><span>每天打开时想看到的话</span><textarea required maxLength={100} value={greeting} onChange={(event) => setGreeting(event.target.value)} /></label>
        <button type="submit" className="primary-button form-submit"><span>保存我们的名字</span><span aria-hidden="true">♥</span></button>
      </form>
    </ModalShell>
  )
}

