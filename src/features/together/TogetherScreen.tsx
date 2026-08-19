import { useRef, useState, type ChangeEvent } from 'react'
import { CapsuleModal } from '../../components/CapsuleModal'
import { ProfileModal } from '../../components/ProfileModal'
import type { CoupleProfile, TimeCapsule } from '../../domain/wish'
import { daysSince, daysUntil, formatChineseDate } from '../../utils/date'

const BACKUP_FORMAT = 'future-with-you.full-backup'
const BACKUP_FORMAT_VERSION = 1
const LAST_BACKUP_KEY = 'future-with-you.last-backup-at'

type BackupRecord = Record<string, unknown>

function isRecord(value: unknown): value is BackupRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function createDigest(value: string): Promise<string | null> {
  if (!window.crypto?.subtle) return null
  const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readLastBackupAt(): string | null {
  try { return window.localStorage.getItem(LAST_BACKUP_KEY) }
  catch { return null }
}

function saveLastBackupAt(value: string): void {
  try { window.localStorage.setItem(LAST_BACKUP_KEY, value) }
  catch { /* The downloaded file is still valid when localStorage is unavailable. */ }
}

function formatBackupMoment(value: string | null): string {
  if (!value) return '还没有导出过完整备份'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '上次备份时间未知' : `上次导出：${date.toLocaleString('zh-CN', { hour12: false })}`
}

interface TogetherScreenProps {
  profile: CoupleProfile
  capsules: TimeCapsule[]
  completedCount: number
  memoryCount: number
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

export function TogetherScreen({ profile, capsules, completedCount, memoryCount, photoCount, answerCount, customWishCount,
  romanceEffects, secretUnlocked, isStandalone, canInstall, isIos, exportData, onSaveProfile, onAddCapsule,
  onOpenCapsule, onDeleteCapsule, onSetRomanceEffects, onInstall, onImport, onOpenSecret, onReopenGift,
  onCelebrateCapsule, onNotify }: TogetherScreenProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [capsuleOpen, setCapsuleOpen] = useState(false)
  const [expandedCapsule, setExpandedCapsule] = useState<string | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState(readLastBackupAt)
  const importInput = useRef<HTMLInputElement>(null)
  const togetherDays = daysSince(profile.anniversaryDate)
  const backupSize = formatBackupSize(new Blob([exportData]).size)
  const backupMoment = formatBackupMoment(lastBackupAt)

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
  const exportBackup = async () => {
    try {
      const state: unknown = JSON.parse(exportData)
      const statePayload = JSON.stringify(state)
      const exportedAt = new Date().toISOString()
      const checksum = await createDigest(statePayload)
      const backup = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt,
        app: { name: 'Future With You', stateVersion: isRecord(state) ? state.version : undefined },
        integrity: checksum ? { algorithm: 'SHA-256', value: checksum } : null,
        summary: {
          completedWishes: completedCount,
          storyMemories: memoryCount,
          localPhotos: photoCount,
          dailyAnswers: answerCount,
          customWishes: customWishCount,
          timeCapsules: capsules.length,
        },
        state,
      }
      const payload = JSON.stringify(backup, null, 2)
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `future-with-you-full-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
      saveLastBackupAt(exportedAt)
      setLastBackupAt(exportedAt)
      onNotify(`完整备份已下载（${formatBackupSize(blob.size)}）`)
    } catch {
      onNotify('备份创建失败，请确认浏览器允许下载后再试一次')
    }
  }
  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!window.confirm('恢复会用备份内容替换当前设备上的全部记录。建议先下载一份当前备份，确定继续吗？')) {
      event.target.value = ''
      return
    }
    try {
      const raw = await file.text()
      const parsed: unknown = JSON.parse(raw)
      let statePayload = raw
      if (isRecord(parsed) && parsed.format === BACKUP_FORMAT) {
        if (parsed.formatVersion !== BACKUP_FORMAT_VERSION || !('state' in parsed)) throw new Error('unsupported backup')
        statePayload = JSON.stringify(parsed.state)
        if (parsed.integrity !== null && parsed.integrity !== undefined) {
          if (!isRecord(parsed.integrity) || parsed.integrity.algorithm !== 'SHA-256' || typeof parsed.integrity.value !== 'string') {
            throw new Error('invalid integrity metadata')
          }
          const checksum = await createDigest(statePayload)
          if (checksum && checksum !== parsed.integrity.value) {
            onNotify('备份完整性校验失败，文件可能已损坏，请不要恢复')
            return
          }
        }
      }
      const success = onImport(statePayload)
      onNotify(success ? '完整备份恢复成功，欢迎回来' : '这份文件不是可识别的 Future With You 备份')
    } catch {
      onNotify('备份无法读取、版本不兼容或文件已经损坏')
    } finally {
      event.target.value = ''
    }
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
        <div><span aria-hidden="true">✦</span><strong>{memoryCount}</strong><small>故事回忆</small></div>
        <div><span aria-hidden="true">✓</span><strong>{completedCount}</strong><small>成真愿望</small></div>
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

      <section className="data-vault" aria-labelledby="data-vault-title">
        <div className="data-vault__heading">
          <span className="data-vault__seal" aria-hidden="true">♥</span>
          <div><p className="section-kicker">TAKE OUR STORY WITH US</p><h2 id="data-vault-title">数据保险箱</h2></div>
        </div>
        <p className="data-vault__intro">把这台设备里的全部故事封装成一个可带走的 JSON 文件。它包含资料、愿望状态、回忆文字、照片、每日回答、时间胶囊与偏好设置。</p>
        <div className="data-vault__summary" aria-label="本次备份内容摘要">
          <span><strong>{memoryCount}</strong><small>故事回忆</small></span>
          <span><strong>{photoCount}</strong><small>照片</small></span>
          <span><strong>{answerCount}</strong><small>回答</small></span>
          <span><strong>{customWishCount}</strong><small>自定义愿望</small></span>
          <span><strong>{capsules.length}</strong><small>时间胶囊</small></span>
        </div>
        <div className="data-vault__actions">
          <button type="button" className="primary-button data-vault__download" onClick={exportBackup}><span>下载完整备份</span><small>约 {backupSize}</small></button>
          <button type="button" className="secondary-button" onClick={() => importInput.current?.click()}>从备份恢复</button>
        </div>
        <p className="data-vault__status" role="status">{backupMoment}</p>
        <p className="data-vault__privacy" id="backup-privacy-note">备份含有你们的私人文字与照片。请保存在自己的手机“文件”、电脑或可信云盘，不要发给陌生人。</p>
        <input ref={importInput} className="visually-hidden" type="file" accept="application/json,.json" aria-describedby="backup-privacy-note" onChange={importBackup} />
      </section>

      <section className="settings-section">
        <div className="section-title-row"><div><p className="section-kicker">PERSONAL TOUCH</p><h2>礼物设置</h2></div></div>
        <label className="setting-row"><span><strong>浪漫氛围特效</strong><small>花瓣、光晕与完成庆祝动画</small></span><input type="checkbox" checked={romanceEffects} onChange={(event) => onSetRomanceEffects(event.target.checked)} /></label>
        <button type="button" className="setting-row setting-row--button" onClick={onReopenGift}><span><strong>重看礼物开场</strong><small>不会清除任何记录</small></span><i aria-hidden="true">→</i></button>
      </section>

      <p className="local-data-note">dist 只放网站程序，不保存你们的记录；下载的 JSON 才是可以带走、跨版本恢复的副本。换域名、清理浏览器或卸载应用前，请先备份。</p>

      {profileOpen && <ProfileModal profile={profile} onSave={saveProfile} onClose={() => setProfileOpen(false)} />}
      {capsuleOpen && <CapsuleModal onSave={saveCapsule} onClose={() => setCapsuleOpen(false)} />}
    </section>
  )
}
