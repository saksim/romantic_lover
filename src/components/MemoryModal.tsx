import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { CoupleProfile, Memory, MemoryCreator, MemoryInput, MemoryKind } from '../domain/wish'
import { compressImage } from '../utils/image'
import { todayKey } from '../utils/date'
import { ModalShell } from './ModalShell'

interface MemoryModalProps {
  memory?: Memory
  profile: CoupleProfile
  onSave: (input: MemoryInput) => void
  onClose: () => void
}

const kindOptions: Array<{ value: MemoryKind; symbol: string; label: string }> = [
  { value: 'milestone', symbol: '✦', label: '重要时刻' },
  { value: 'date', symbol: '♥', label: '约会心动' },
  { value: 'trip', symbol: '↗', label: '旅行足迹' },
  { value: 'gift', symbol: '◇', label: '礼物珍藏' },
  { value: 'ordinary', symbol: '○', label: '普通日常' },
  { value: 'conversation', symbol: '“”', label: '一句真心' },
]

export function MemoryModal({ memory, profile, onSave, onClose }: MemoryModalProps) {
  const [title, setTitle] = useState(memory?.title ?? '')
  const [story, setStory] = useState(memory?.story ?? '')
  const [occurredAt, setOccurredAt] = useState(memory?.occurredAt.slice(0, 10) ?? todayKey())
  const [kind, setKind] = useState<MemoryKind>(memory?.kind ?? 'ordinary')
  const [createdBy, setCreatedBy] = useState<MemoryCreator>(memory?.createdBy ?? 'together')
  const [location, setLocation] = useState(memory?.location ?? '')
  const [tags, setTags] = useState(memory?.tags.join('，') ?? '')
  const [featured, setFeatured] = useState(memory?.featured ?? false)
  const [photoDataUrl, setPhotoDataUrl] = useState(memory?.media[0]?.dataUrl ?? '')
  const [photoTouched, setPhotoTouched] = useState(!memory)
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [error, setError] = useState('')

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setProcessingPhoto(true)
    try {
      setPhotoDataUrl(await compressImage(file, 1200, 0.76))
      setPhotoTouched(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '照片处理失败，请换一张试试。')
    } finally {
      setProcessingPhoto(false)
    }
  }

  const removePhoto = () => {
    setPhotoDataUrl('')
    setPhotoTouched(true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsedTags = tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
    onSave({
      title,
      story,
      occurredAt,
      kind,
      createdBy,
      tags: parsedTags,
      location,
      featured,
      photoDataUrl: photoTouched ? photoDataUrl : undefined,
    })
  }

  const creators: Array<{ value: MemoryCreator; label: string }> = [
    { value: 'together', label: '我们共同' },
    { value: 'me', label: profile.myName },
    { value: 'partner', label: profile.partnerName },
  ]

  return (
    <ModalShell title={memory ? '编辑这段故事' : '收藏一段新回忆'} eyebrow="ADD TO OUR UNIVERSE" onClose={onClose} size="large">
      <form className="romance-form memory-form" onSubmit={submit}>
        <label className="form-field">
          <span>这段回忆叫什么？</span>
          <input required maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：第一次一起看海" autoFocus />
        </label>

        <div className="form-columns">
          <label className="form-field">
            <span>发生在什么时候？</span>
            <input type="date" required max={todayKey()} value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
          </label>
          <label className="form-field">
            <span>发生在哪里？ <small>可选</small></span>
            <input maxLength={60} value={location} onChange={(event) => setLocation(event.target.value)}
              placeholder="城市、街道或一个小角落" />
          </label>
        </div>

        <fieldset className="form-field">
          <legend>它属于哪一种故事？</legend>
          <div className="choice-grid choice-grid--three memory-kind-grid">
            {kindOptions.map((option) => (
              <button type="button" className={kind === option.value ? 'is-selected' : ''}
                onClick={() => setKind(option.value)} key={option.value}>
                <span aria-hidden="true">{option.symbol}</span>{option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-field">
          <legend>是谁写下的？</legend>
          <div className="choice-grid choice-grid--three">
            {creators.map((creator) => (
              <button type="button" className={createdBy === creator.value ? 'is-selected' : ''}
                onClick={() => setCreatedBy(creator.value)} key={creator.value}>{creator.label}</button>
            ))}
          </div>
        </fieldset>

        <label className="form-field">
          <span>最想记住的细节</span>
          <textarea required maxLength={800} value={story} onChange={(event) => setStory(event.target.value)}
            placeholder="风是什么味道？她说了什么？那一刻为什么值得记住？" />
        </label>

        <label className="form-field">
          <span>标签 <small>用逗号分开，最多 8 个</small></span>
          <input maxLength={100} value={tags} onChange={(event) => setTags(event.target.value)}
            placeholder="第一次，海边，夏天" />
        </label>

        <div className="form-field">
          <span>展品照片 <small>会压缩后保存</small></span>
          {photoDataUrl ? (
            <div className="photo-preview">
              <img src={photoDataUrl} alt="准备放进故事宇宙的照片" />
              <button type="button" onClick={removePhoto}>换一张 / 移除</button>
            </div>
          ) : (
            <label className={`photo-picker${processingPhoto ? ' is-loading' : ''}`}>
              <input type="file" accept="image/*" onChange={selectPhoto} disabled={processingPhoto} />
              <span aria-hidden="true">＋</span>
              <strong>{processingPhoto ? '正在温柔地处理照片…' : '选择一张照片或聊天截图'}</strong>
              <small>V0.4 每段故事先保存一张封面</small>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <label className="memory-feature-toggle">
          <span><strong>设为珍藏展品</strong><small>会成为大星星，并优先出现在博物馆</small></span>
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
        </label>

        <button type="submit" className="primary-button form-submit"
          disabled={!title.trim() || !story.trim() || !occurredAt || processingPhoto}>
          <span>{memory ? '保存这次修改' : '放进我们的故事宇宙'}</span><span aria-hidden="true">✦</span>
        </button>
      </form>
    </ModalShell>
  )
}
