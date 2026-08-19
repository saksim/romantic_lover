import { useState, type FormEvent } from 'react'
import type { Category, CategoryId, CoupleProfile, CustomWishInput, DateDuration, DateSetting, WishCreator } from '../domain/wish'
import { ModalShell } from './ModalShell'

interface CustomWishModalProps {
  categories: Category[]
  profile: CoupleProfile
  onSave: (wish: CustomWishInput) => void
  onClose: () => void
}

export function CustomWishModal({ categories, profile, onSave, onClose }: CustomWishModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [moment, setMoment] = useState('')
  const [category, setCategory] = useState<CategoryId>('daily')
  const [createdBy, setCreatedBy] = useState<WishCreator>('partner')
  const [plannedFor, setPlannedFor] = useState('')
  const [setting, setSetting] = useState<DateSetting>('either')
  const [duration, setDuration] = useState<DateDuration>('evening')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    onSave({ title, description, moment, category, createdBy, plannedFor, setting, duration, source: 'custom' })
  }

  return (
    <ModalShell title="亲手写一个愿望" eyebrow="ADD TO OUR FUTURE" onClose={onClose} size="large">
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field">
          <span>想一起做什么 <em>必填</em></span>
          <input autoFocus required maxLength={42} value={title} onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：周五晚上去吃她一直想吃的店" />
        </label>
        <label className="form-field">
          <span>补充一点细节</span>
          <textarea maxLength={140} value={description} onChange={(event) => setDescription(event.target.value)}
            placeholder="时间、地点，或者为什么想一起做这件事…" />
        </label>
        <label className="form-field">
          <span>留给这张卡的一句话</span>
          <input maxLength={70} value={moment} onChange={(event) => setMoment(event.target.value)}
            placeholder="等我们做到时，它就会变成回忆。" />
        </label>

        <fieldset className="form-field">
          <legend>这是谁写下的？</legend>
          <div className="choice-grid choice-grid--two">
            <button type="button" className={createdBy === 'me' ? 'is-selected' : ''} onClick={() => setCreatedBy('me')}>{profile.myName}</button>
            <button type="button" className={createdBy === 'partner' ? 'is-selected' : ''} onClick={() => setCreatedBy('partner')}>{profile.partnerName}</button>
          </div>
        </fieldset>

        <fieldset className="form-field">
          <legend>放在哪个章节？</legend>
          <div className="choice-grid choice-grid--categories">
            {categories.map((item) => (
              <button type="button" className={category === item.id ? 'is-selected' : ''} onClick={() => setCategory(item.id)} key={item.id}>
                <span aria-hidden="true">{item.symbol}</span>{item.shortName}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-columns">
          <fieldset className="form-field">
            <legend>想在哪里？</legend>
            <div className="choice-grid choice-grid--three">
              {([['home', '宅家'], ['out', '出门'], ['either', '都行']] as const).map(([value, label]) => (
                <button type="button" className={setting === value ? 'is-selected' : ''} onClick={() => setSetting(value)} key={value}>{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="form-field">
            <legend>需要多久？</legend>
            <div className="choice-grid choice-grid--three">
              {([['quick', '半小时'], ['evening', '一晚'], ['day', '半天+']] as const).map(([value, label]) => (
                <button type="button" className={duration === value ? 'is-selected' : ''} onClick={() => setDuration(value)} key={value}>{label}</button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="form-field">
          <span>想在哪一天实现？ <small>可以以后再定</small></span>
          <input type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} />
        </label>

        <button type="submit" className="primary-button form-submit" disabled={!title.trim()}>
          <span>把它写进我们的未来</span><span aria-hidden="true">♥</span>
        </button>
      </form>
    </ModalShell>
  )
}

