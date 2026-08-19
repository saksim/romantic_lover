import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { CompletionDetails, Wish, WishProgress } from '../domain/wish'
import { compressImage } from '../utils/image'
import { todayKey } from '../utils/date'
import { ModalShell } from './ModalShell'

interface CompletionModalProps {
  wish: Wish
  progress?: WishProgress
  onSave: (details: CompletionDetails) => void
  onClose: () => void
}

export function CompletionModal({ wish, progress, onSave, onClose }: CompletionModalProps) {
  const [completedAt, setCompletedAt] = useState(progress?.completedAt?.slice(0, 10) ?? todayKey())
  const [note, setNote] = useState(progress?.note ?? '')
  const [photoDataUrl, setPhotoDataUrl] = useState(progress?.photoDataUrl ?? '')
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [error, setError] = useState('')

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setProcessingPhoto(true)
    try {
      setPhotoDataUrl(await compressImage(file))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '照片处理失败，请换一张试试。')
    } finally {
      setProcessingPhoto(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave({ completedAt, note, photoDataUrl: photoDataUrl || undefined })
  }

  return (
    <ModalShell title={progress?.completed ? '编辑这段回忆' : '把这一天保存下来'} eyebrow="WE REALLY DID IT" onClose={onClose} size="large">
      <div className="completion-wish-preview">
        <span aria-hidden="true">✓</span>
        <div><small>{progress?.completed ? 'OUR MEMORY' : 'WISH COMPLETED'}</small><strong>{wish.title}</strong></div>
      </div>
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field">
          <span>是哪一天？</span>
          <input type="date" required max={todayKey()} value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} />
        </label>
        <label className="form-field">
          <span>那天最想记住什么？</span>
          <textarea maxLength={360} value={note} onChange={(event) => setNote(event.target.value)}
            placeholder="例如：我们真的去看海了。风很大，她笑得比日落还好看。" />
        </label>
        <div className="form-field">
          <span>留一张照片 <small>会压缩后保存在当前设备</small></span>
          {photoDataUrl ? (
            <div className="photo-preview">
              <img src={photoDataUrl} alt="准备保存的回忆" />
              <button type="button" onClick={() => setPhotoDataUrl('')}>换一张 / 移除</button>
            </div>
          ) : (
            <label className={`photo-picker${processingPhoto ? ' is-loading' : ''}`}>
              <input type="file" accept="image/*" onChange={selectPhoto} disabled={processingPhoto} />
              <span aria-hidden="true">＋</span>
              <strong>{processingPhoto ? '正在温柔地处理照片…' : '选择一张纪念照片'}</strong>
              <small>照片仅留在这台设备</small>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <button type="submit" className="primary-button form-submit" disabled={!completedAt || processingPhoto}>
          <span>{progress?.completed ? '保存修改' : '点亮这段回忆'}</span><span aria-hidden="true">✦</span>
        </button>
      </form>
    </ModalShell>
  )
}

