import { useState } from 'react'
import type { CloudAccountController } from '../hooks/useCloudAccount'
import { CloudAccountModal, type CloudDialogMode } from './CloudAccountModal'

interface CloudAccountPanelProps {
  account: CloudAccountController
  onNotify: (message: string) => void
}

function formatExpiry(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '20 分钟内有效' : `${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 前有效`
}

export function CloudAccountPanel({ account, onNotify }: CloudAccountPanelProps) {
  const [dialog, setDialog] = useState<CloudDialogMode | null>(null)
  const backendName = account.provider === 'cloudbase-pg' ? 'CloudBase 大陆云' : account.provider === 'supabase' ? 'Supabase 海外云' : '本地安全模式'
  const openDialog = (nextDialog: CloudDialogMode) => {
    account.clearError()
    setDialog(nextDialog)
  }
  const copyInvite = async () => {
    if (!account.invite) return
    try {
      await navigator.clipboard.writeText(account.invite.code)
      onNotify('邀请码已经复制，发给她就好')
    } catch {
      onNotify('浏览器没有允许复制，请长按邀请码手动复制')
    }
  }
  const generateInvite = async () => {
    if (await account.createInvite()) onNotify('新的单次邀请码已经生成')
  }
  const leaveSpace = async () => {
    if (!window.confirm('退出后你将不能再读取这个云端空间，但本机的本地记录不会删除。确定退出吗？')) return
    if (await account.leaveCouple()) onNotify('你已经退出云端情侣空间，本地内容仍在这台设备上')
  }

  if (!account.enabled) {
    return <section className="cloud-space-card cloud-space-card--local" aria-labelledby="cloud-space-title">
      <div className="cloud-space-card__heading"><span aria-hidden="true">☁</span><div><p className="section-kicker">LOCAL SAFE MODE</p><h2 id="cloud-space-title">云端双人空间尚未开启</h2></div></div>
      <p>当前构建继续使用本地数据。海外 Supabase 或大陆 CloudBase 只有在账号、RLS 和双设备验收通过后才会启用。</p>
      <span className="cloud-status-pill">本地内容安全保留</span>
    </section>
  }

  if (account.configurationIssue) {
    return <section className="cloud-space-card cloud-space-card--warning" aria-labelledby="cloud-space-title">
      <div className="cloud-space-card__heading"><span aria-hidden="true">!</span><div><p className="section-kicker">CLOUD DIAGNOSTIC</p><h2 id="cloud-space-title">云端配置还差一步</h2></div></div>
      <p>{account.configurationIssue}</p>
    </section>
  }

  if (account.loading) {
    return <section className="cloud-space-card" aria-live="polite"><div className="cloud-loading"><span aria-hidden="true">∞</span><p>正在寻找你们的云端空间…</p></div></section>
  }
  if (!account.ready) {
    return <section className="cloud-space-card cloud-space-card--warning" aria-live="polite">
      <div className="cloud-space-card__heading"><span aria-hidden="true">!</span><div><p className="section-kicker">CLOUD CONNECTION</p><h2>云端组件没有准备好</h2></div></div>
      <p>{account.error ?? 'CloudBase 组件没有成功加载，请重新连接。'}</p>
      <button type="button" className="secondary-button" onClick={() => window.location.reload()}>重新连接云端</button>
    </section>
  }


  if (!account.session) {
    return <>
      <section className="cloud-space-card" aria-labelledby="cloud-space-title">
        <div className="cloud-space-card__heading"><span aria-hidden="true">☁</span><div><p className="section-kicker">TWO DEVICES, ONE STORY</p><h2 id="cloud-space-title">开启云端双人空间</h2></div></div>
        <p>登录后可以创建情侣空间或输入她的邀请码。Alpha 3 大陆适配先打通身份与绑定关系，本地故事暂时不会自动上传。</p>
        <span className="cloud-status-pill">{backendName}</span>
        {account.confirmationEmail && <p className="cloud-confirmation" role="status">验证邮件已发送到 {account.confirmationEmail}</p>}
        {account.error && <p className="cloud-inline-error" role="alert">{account.error}</p>}
        <button type="button" className="primary-button cloud-primary-action" onClick={() => openDialog('auth')}>登录或创建账号</button>
      </section>
      {dialog && <CloudAccountModal key={dialog} mode={dialog} account={account} onClose={() => setDialog(null)} onNotify={onNotify} />}
    </>
  }

  const myName = account.profile?.displayName ?? account.session.user.displayName
  return <>
    <section className={`cloud-space-card${account.couple ? ' is-connected' : ''}`} aria-labelledby="cloud-space-title">
      <div className="cloud-space-card__heading"><span aria-hidden="true">{account.couple ? '∞' : '♡'}</span><div><p className="section-kicker">{account.couple ? 'CONNECTED TO OUR SPACE' : 'ACCOUNT CONNECTED'}</p><h2 id="cloud-space-title">{account.couple?.couple.name ?? `${myName}，欢迎来到云端`}</h2></div></div>
      {account.couple ? <>
        <p>{account.couple.couple.greeting || '两个人已经在同一个空间里。'}</p>
        <div className="cloud-member-list" aria-label="情侣空间成员">
          {account.couple.members.map((member) => <span key={member.userId} className={member.userId === account.session!.user.id ? 'is-me' : ''}><i aria-hidden="true">{member.memberSlot === 1 ? '♥' : '♡'}</i><strong>{member.displayName ?? (member.userId === account.session!.user.id ? myName : '另一半')}</strong><small>{member.userId === account.session!.user.id ? '我' : '她'} · {member.role === 'owner' ? '创建者' : '伴侣'}</small></span>)}
          {account.couple.members.length < 2 && <span className="is-waiting"><i aria-hidden="true">＋</i><strong>等待她加入</strong><small>生成一次性邀请码</small></span>}
        </div>
        {account.invite ? <div className="cloud-invite-box"><small>ONE-TIME INVITE</small><button type="button" onClick={copyInvite} aria-label={`复制邀请码 ${account.invite.code}`}>{account.invite.code}</button><span>{formatExpiry(account.invite.expiresAt)}</span></div> : account.couple.members.length < 2 && <button type="button" className="primary-button cloud-primary-action" disabled={account.busy} onClick={generateInvite}>{account.busy ? '正在生成…' : '生成给她的邀请码'}</button>}
      </> : <>
        <p>账号已经连接，但还没有绑定情侣空间。你可以创建一个空间，再把邀请码发给她；也可以输入她发来的邀请码。</p>
        <div className="cloud-space-actions"><button type="button" className="primary-button" onClick={() => openDialog('create')}>创建情侣空间</button><button type="button" className="secondary-button" onClick={() => openDialog('join')}>输入邀请码加入</button></div>
      </>}
      {account.error && <p className="cloud-inline-error" role="alert">{account.error}</p>}
      <div className="cloud-account-footer"><button type="button" onClick={() => openDialog('profile')}>编辑我的资料</button>{account.couple && <button type="button" className="is-danger" onClick={leaveSpace}>退出情侣空间</button>}<button type="button" onClick={() => void account.signOut()}>退出登录</button></div>
      <p className="cloud-alpha-note">Alpha 3 · {backendName}：账号和情侣关系已连接；愿望、回忆与照片仍以本机为准，不会在本 PR 中静默迁移或跨云双写。</p>
    </section>
    {dialog && <CloudAccountModal key={dialog} mode={dialog} account={account} onClose={() => setDialog(null)} onNotify={onNotify} />}
  </>
}
