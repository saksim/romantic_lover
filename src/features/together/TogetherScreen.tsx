import { useRef, useState, type ChangeEvent } from 'react'
import { CapsuleModal } from '../../components/CapsuleModal'
import { ProfileModal } from '../../components/ProfileModal'
import type { CoupleProfile, TimeCapsule } from '../../domain/wish'
import { daysSince, daysUntil, formatChineseDate } from '../../utils/date'

interface TogetherScreenProps {
  profile: CoupleProfile
  capsules: TimeCapsule[]
  completedCount: number
  photoCount: number
  answerCount: number
  customWishCount: number
  romanceEffects: boolean
  secretUnlocked: boolean
  isStandalone: boolean
  canInstall: boolean
  isIos: boolean
  exportData: string
  onSaveProfile: (profile: CoupleProfile) => void
  onAddCapsule: (capsule: Pick<TimeCapsule, 'title' | 'message' | 'openAt'>) => void
  onOpenCapsule: (capsuleId: string) => void
  onDeleteCapsule: (capsuleId: string) => void
  onSetRomanceEffects: (enabled: boolean) => void
  onInstall: () => Promise<boolean>
  onImport: (raw: string) => boolean
  onOpenSecret: () => void
  onReopenGift: () => void
  onCelebrateCapsule: () => void
  onNotify: (message: string) => void
}

export function TogetherScreen({ profile, capsules, completedCount, photoCount, answerCount, customWishCount,
  romanceEffects, secretUnlocked, isStandalone, canInstall, isIos, exportData, onSaveProfile, onAddCapsule,
  onOpenCapsule, onDeleteCapsule, onSetRomanceEffects, onInstall, onImport, onOpenSecret, onReopenGift,
  onCelebrateCapsule, onNotify }: TogetherScreenProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [capsuleOpen, setCapsuleOpen] = useState(false)
  const [expandedCapsule, setExpandedCapsule] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const togetherDays = daysSince(profile.anniversaryDate)

  const saveProfile = (nextProfile: CoupleProfile) => {
    onSaveProfile(nextProfile)
    setProfileOpen(false)
    onNotify('这里现在更像你们了')
  }
  const saveCapsule = (capsule: Pick<TimeCapsule, 'title' | 'message' | 'openAt'>) => {
    onAddCapsule(capsule)
    setCapsuleOpen(false)
    onNotify('这封信已经交给时间保管')
  }
  const openCapsule = (capsule: TimeCapsule) => {
    if (!capsule.openedAt && daysUntil(capsule.openAt) > 0) return
    if (!capsule.openedAt) {
      onOpenCapsule(capsule.id)
      onCelebrateCapsule()
    }
    setExpandedCapsule(expandedCapsule === capsule.id ? null : capsule.id)
  }
  const removeCapsule = (capsule: TimeCapsule) => {
    if (!window.confirm(`确定删除“${capsule.title}”吗？`)) return
    onDeleteCapsule(capsule.id)
    onNotify('时间胶囊已经删除')
  }
  const exportBackup = () => {
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `future-with-you-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    onNotify('你们的故事备份已经保存')
  }
  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const success = onImport(await file.text())
    onNotify(success ? '备份恢复成功，欢迎回来' : '这份文件不是可识别的 Future With You 备份')
    event.target.value = ''
  }
  const install = async () => {
    const installed = await onInstall()
    onNotify(installed ? 'Future With You 已经留在桌面上' : '浏览器没有完成安装，可以参考下方提示')
  }

  return (
    <section className="together-screen" aria-labelledby="together-title">
      <div className="together-heading"><p className="section-kicker">A PLACE CALLED US</p><h1 id="together-title">只属于我们的空间</h1><p>不是功能设置页，而是这份礼物慢慢长成你们生活的地方。</p></div>

      <section className="couple-profile-card">
        <div className="couple-profile-card__names"><span>{profile.myName.slice(0, 1)}</span><i>♥</i><span>{profile.partnerName.slice(0, 1)}</span></div>
        <p className="section-kicker">OUR STORY SO FAR</p>
        <h2>{profile.myName} & {profile.partnerName}</h2>
        <p>{profile.greeting}</p>
        <div className="couple-profile-card__days"><strong>{togetherDays ?? '∞'}</strong><span>{togetherDays ? `从 ${formatChineseDate(profile.anniversaryDate)} 开始` : '填写纪念日，开始记录共同天数'}</span></div>
        <button type="button" className="light-button" onClick={() => setProfileOpen(true)}>编辑我们的资料</button>
      </section>

      <div className="our-stats-grid">
        <div><span aria-hidden="true">✓</span><strong>{completedCount}</strong><small>共同回忆</small></div>
        <div><span aria-hidden="true">▧</span><strong>{photoCount}</strong><small>纪念照片</small></div>
        <div><span aria-hidden="true">?</span><strong>{answerCount}</strong><small>认真回答</small></div>
        <div><span aria-hidden="true">✎</span><strong>{customWishCount}</strong><small>亲手愿望</small></div>
      </div>

      <section className="capsule-section">
        <div className="section-title-row"><div><p className="section-kicker">LET TIME KEEP IT</p><h2>时间胶囊</h2></div><button type="button" onClick={() => setCapsuleOpen(true)}>＋ 写一封</button></div>
        {capsules.length ? <div className="capsule-list">{capsules.map((capsule) => {
          const remaining = daysUntil(capsule.openAt)
          const opened = Boolean(capsule.openedAt)
          const expanded = expandedCapsule === capsule.id
          return <article className={`capsule-card${opened ? ' is-opened' : ''}${remaining === 0 ? ' is-ready' : ''}`} key={capsule.id}>
            <button type="button" className="capsule-card__main" onClick={() => openCapsule(capsule)}>
              <span className="capsule-card__seal" aria-hidden="true">{opened ? '♥' : '✉'}</span>
              <span className="capsule-card__copy"><small>{opened ? 'LETTER OPENED' : remaining === 0 ? 'READY TO OPEN' : `${remaining} DAYS LEFT`}</small><strong>{capsule.title}</strong><em>{opened ? `打开于 ${formatChineseDate(capsule.openedAt)}` : `${formatChineseDate(capsule.openAt)} 可以打开`}</em></span>
              <span aria-hidden="true">{opened ? (expanded ? '↑' : '↓') : '⌁'}</span>
            </button>
            {expanded && opened && <div className="capsule-letter"><p>{capsule.message}</p><small>写于 {formatChineseDate(capsule.createdAt)}</small></div>}
            <button type="button" className="capsule-delete" onClick={() => removeCapsule(capsule)}>删除</button>
          </article>
        })}</div> : <div className="capsule-empty"><span aria-hidden="true">✉</span><p>写一封今天不能立刻打开的信，让未来的某一天替你们拆开。</p><button type="button" className="secondary-button" onClick={() => setCapsuleOpen(true)}>创建第一封时间胶囊</button></div>}
      </section>

      {secretUnlocked && <button type="button" className="infinity-shortcut" onClick={onOpenSecret}><span aria-hidden="true">∞</span><div><small>THE WISH WITHOUT AN END</small><strong>再读一次，没有最后一页的愿望</strong></div><i aria-hidden="true">→</i></button>}

      <section className="install-card">
        <div className="install-card__icon" aria-hidden="true">∞</div>
        <div><p className="section-kicker">KEEP US CLOSE</p><h2>把我们的未来留在桌面上</h2>
          <p>{isStandalone ? '已经安装好了。以后从手机桌面打开，就像一个真正属于你们的 App。' : canInstall ? '不需要应用商店，轻触一次就能把它留在主屏幕。' : isIos ? '在 Safari 底部点击“分享”，再选择“添加到主屏幕”。' : '在浏览器菜单中选择“安装应用”或“添加到主屏幕”。'}</p>
        </div>
        {!isStandalone && canInstall && <button type="button" className="primary-button" onClick={install}>现在安装</button>}
      </section>

      <section className="settings-section">
        <div className="section-title-row"><div><p className="section-kicker">KEEP IT SAFE</p><h2>礼物与数据</h2></div></div>
        <label className="setting-row"><span><strong>浪漫氛围特效</strong><small>花瓣、光晕与完成庆祝动画</small></span><input type="checkbox" checked={romanceEffects} onChange={(event) => onSetRomanceEffects(event.target.checked)} /></label>
        <button type="button" className="setting-row setting-row--button" onClick={onReopenGift}><span><strong>重看礼物开场</strong><small>不会清除任何记录</small></span><i aria-hidden="true">→</i></button>
        <button type="button" className="setting-row setting-row--button" onClick={exportBackup}><span><strong>备份我们的故事</strong><small>导出愿望、答案、时间胶囊和本地照片</small></span><i aria-hidden="true">↓</i></button>
        <button type="button" className="setting-row setting-row--button" onClick={() => importInput.current?.click()}><span><strong>恢复一份备份</strong><small>会替换当前设备里的记录</small></span><i aria-hidden="true">↑</i></button>
        <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} />
      </section>

      <p className="local-data-note">V0.2 的内容只保存在当前设备。照片会被压缩；定期导出备份，可以避免浏览器清理数据后丢失。</p>

      {profileOpen && <ProfileModal profile={profile} onSave={saveProfile} onClose={() => setProfileOpen(false)} />}
      {capsuleOpen && <CapsuleModal onSave={saveCapsule} onClose={() => setCapsuleOpen(false)} />}
    </section>
  )
}
