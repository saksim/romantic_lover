import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getCaptchaClientConfig } from '../cloud/captchaConfig'
import type { CloudAccountController } from '../hooks/useCloudAccount'
import { CaptchaChallenge } from './CaptchaChallenge'
import { ModalShell } from './ModalShell'

export type CloudDialogMode = 'auth' | 'create' | 'join' | 'profile'

interface CloudAccountModalProps {
  mode: CloudDialogMode
  account: CloudAccountController
  onClose: () => void
  onNotify: (message: string) => void
  offerLocalMode?: boolean
}

export function CloudAccountModal({ mode, account, onClose, onNotify, offerLocalMode = false }: CloudAccountModalProps) {
  useEffect(() => account.clearError(), [account.clearError, mode])

  if (mode === 'auth') {
    return <AuthModal account={account} onClose={onClose} onNotify={onNotify} offerLocalMode={offerLocalMode} />
  }
  if (mode === 'create') {
    return <CreateSpaceModal account={account} onClose={onClose} onNotify={onNotify} />
  }
  if (mode === 'join') {
    return <JoinSpaceModal account={account} onClose={onClose} onNotify={onNotify} />
  }
  return <CloudProfileModal account={account} onClose={onClose} onNotify={onNotify} />
}

function ErrorMessage({ account }: { account: CloudAccountController }) {
  return account.error ? <p className="cloud-form-error" role="alert">{account.error}</p> : null
}

function AuthModal({ account, onClose, onNotify, offerLocalMode }: Omit<CloudAccountModalProps, 'mode'>) {
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string>()
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const captchaConfig = useMemo(getCaptchaClientConfig, [])
  const captchaPending = captchaConfig.enabled && !captchaToken
  const submitDisabled = account.busy || Boolean(captchaConfig.issue) || captchaPending

  const resetCaptcha = () => {
    setCaptchaToken(undefined)
    setCaptchaResetKey((current) => current + 1)
  }

  const changeMode = (nextMode: 'sign-in' | 'sign-up') => {
    setAuthMode(nextMode)
    account.clearError()
    resetCaptcha()
  }
  const continueLocally = () => {
    onNotify('已进入本地模式，云端登录入口仍在“我们”页面')
    onClose()
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (captchaConfig.issue || captchaPending) return
    if (authMode === 'sign-up') {
      const result = await account.signUp({ identifier: email, password, displayName, captchaToken })
      resetCaptcha()
      if (result === 'signed-in') {
        onNotify('账号已经创建，云端双人空间正在等你们')
        onClose()
      } else if (result === 'confirmation-required') {
        onNotify('验证邮件已经发出，请从邮件回到这份礼物')
        onClose()
      }
      return
    }
    const signedIn = await account.signIn({ identifier: email, password, captchaToken })
    resetCaptcha()
    if (signedIn) {
      onNotify('欢迎回来，云端空间已经连接')
      onClose()
    }
  }

  return (
    <ModalShell title={authMode === 'sign-in' ? '回到我们的云端空间' : '为两个人留一个账号'} eyebrow="TWO HEARTS, ONE SPACE" onClose={onClose}>
      <div className="cloud-auth-tabs" role="tablist" aria-label="账号操作">
        <button type="button" role="tab" aria-selected={authMode === 'sign-in'} className={authMode === 'sign-in' ? 'is-active' : ''} onClick={() => changeMode('sign-in')}>登录</button>
        <button type="button" role="tab" aria-selected={authMode === 'sign-up'} className={authMode === 'sign-up' ? 'is-active' : ''} onClick={() => changeMode('sign-up')}>注册</button>
      </div>
      <form className="romance-form" onSubmit={submit}>
        {authMode === 'sign-up' && <label className="form-field"><span>你想被怎样称呼</span><input required autoFocus maxLength={40} autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：小宇" /></label>}
        <label className="form-field"><span>邮箱</span><input required autoFocus={authMode === 'sign-in'} type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="form-field"><span>密码</span><input required minLength={8} type="password" autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" /></label>
        <CaptchaChallenge config={captchaConfig} resetKey={captchaResetKey} onTokenChange={setCaptchaToken} />
        <ErrorMessage account={account} />
        <button type="submit" className="primary-button form-submit" disabled={submitDisabled}><span>{account.busy ? '正在连接…' : captchaConfig.issue ? '验证码配置待完成' : captchaPending ? '请先完成人机验证' : authMode === 'sign-in' ? '登录云端空间' : '创建我的账号'}</span><span aria-hidden="true">♥</span></button>
        <p className="form-note">账号只负责识别“你是谁”。本地愿望与回忆在 Alpha 3 迁移确认前不会自动上传，也不会被覆盖。</p>
        {offerLocalMode && <button type="button" className="cloud-local-mode-button" onClick={continueLocally}>暂时使用本地模式</button>}
      </form>
    </ModalShell>
  )
}

function CreateSpaceModal({ account, onClose, onNotify }: Omit<CloudAccountModalProps, 'mode'>) {
  const [name, setName] = useState('我们的未来')
  const [greeting, setGreeting] = useState('无论相隔多远，我们都在写同一个故事。')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await account.createCouple({ name, greeting })) {
      onNotify('情侣空间已经创建，现在可以邀请她加入')
      onClose()
    }
  }
  return (
    <ModalShell title="创建只属于你们的空间" eyebrow="CREATE OUR SPACE" onClose={onClose}>
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field"><span>空间名字</span><input required autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="form-field"><span>写在门口的话</span><textarea maxLength={240} value={greeting} onChange={(event) => setGreeting(event.target.value)} /></label>
        <ErrorMessage account={account} />
        <button type="submit" className="primary-button form-submit" disabled={account.busy}><span>{account.busy ? '正在创建…' : '创建情侣空间'}</span><span aria-hidden="true">∞</span></button>
      </form>
    </ModalShell>
  )
}

function JoinSpaceModal({ account, onClose, onNotify }: Omit<CloudAccountModalProps, 'mode'>) {
  const [code, setCode] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await account.joinWithInvite(code)) {
      onNotify('你们已经在同一个情侣空间里了')
      onClose()
    }
  }
  return (
    <ModalShell title="用她发来的邀请码相遇" eyebrow="MEET IN THE SAME SPACE" onClose={onClose}>
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field"><span>10 位邀请码</span><input required autoFocus minLength={10} maxLength={10} autoCapitalize="characters" autoComplete="one-time-code" className="invite-code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase())} placeholder="A1B2C3D4E5" /></label>
        <ErrorMessage account={account} />
        <button type="submit" className="primary-button form-submit" disabled={account.busy || code.length !== 10}><span>{account.busy ? '正在加入…' : '加入她的情侣空间'}</span><span aria-hidden="true">♥</span></button>
        <p className="form-note">邀请码有效 20 分钟、只能使用一次。加入成功后，两个人才能读取这个空间的数据。</p>
      </form>
    </ModalShell>
  )
}

function CloudProfileModal({ account, onClose, onNotify }: Omit<CloudAccountModalProps, 'mode'>) {
  const [displayName, setDisplayName] = useState(account.profile?.displayName ?? account.session?.user.displayName ?? '')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await account.updateProfile(displayName)) {
      onNotify('你的云端名字已经更新')
      onClose()
    }
  }
  return (
    <ModalShell title="编辑我的云端资料" eyebrow="THIS IS ME" onClose={onClose}>
      <form className="romance-form" onSubmit={submit}>
        <label className="form-field"><span>显示名字</span><input required autoFocus maxLength={40} autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="form-field"><span>登录邮箱</span><input disabled value={account.session?.user.email ?? ''} /></label>
        <ErrorMessage account={account} />
        <button type="submit" className="primary-button form-submit" disabled={account.busy}><span>{account.busy ? '正在保存…' : '保存云端资料'}</span><span aria-hidden="true">♥</span></button>
      </form>
    </ModalShell>
  )
}
