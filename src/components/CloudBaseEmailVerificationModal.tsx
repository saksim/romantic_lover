import { useState, type FormEvent } from 'react'
import { cancelCloudBaseCaptcha } from '../cloud/cloudbaseCaptcha'
import type { CloudAccountController } from '../hooks/useCloudAccount'
import { CloudBaseCaptchaChallenge } from './CloudBaseCaptchaChallenge'
import { ModalShell } from './ModalShell'

interface CloudBaseEmailVerificationModalProps {
  account: CloudAccountController
  onClose: () => void
  onNotify: (message: string) => void
}

export function CloudBaseEmailVerificationModal({
  account,
  onClose,
  onNotify,
}: CloudBaseEmailVerificationModalProps) {
  const [code, setCode] = useState('')
  const verification = account.signUpVerification

  if (!verification) return null

  const close = () => {
    cancelCloudBaseCaptcha()
    onClose()
  }

  const restart = () => {
    cancelCloudBaseCaptcha()
    account.clearError()
    account.clearSignUpVerification()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await account.verifySignUp(code)) {
      onNotify('邮箱已经确认，欢迎来到你们的云端空间')
      close()
    }
  }

  return (
    <ModalShell title="把验证码写进这封信" eyebrow="ONE LAST LITTLE STEP" onClose={close}>
      <form className="romance-form cloud-otp-form" onSubmit={submit}>
        <div className="cloud-otp-letter" role="status">
          <span aria-hidden="true">✉</span>
          <div><strong>验证码已发到</strong><p>{verification.destination}</p></div>
        </div>
        <label className="form-field">
          <span>邮箱验证码</span>
          <input
            required
            autoFocus
            minLength={4}
            maxLength={8}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="cloud-otp-input"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
            placeholder="输入邮件中的验证码"
          />
        </label>
        <CloudBaseCaptchaChallenge />
        {account.error && <p className="cloud-form-error" role="alert">{account.error}</p>}
        <button type="submit" className="primary-button form-submit" disabled={account.busy || code.length < 4}>
          <span>{account.busy ? '正在确认…' : '确认并进入我们的空间'}</span><span aria-hidden="true">♥</span>
        </button>
        <button type="button" className="cloud-local-mode-button" onClick={restart}>返回修改邮箱或重新发送</button>
        <p className="form-note">验证码只用于完成 CloudBase 注册，不会读取你的邮箱内容；本机愿望和回忆仍留在本机。</p>
      </form>
    </ModalShell>
  )
}
