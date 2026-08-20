import { useState, useSyncExternalStore } from 'react'
import {
  getCloudBaseCaptchaSnapshot,
  refreshCloudBaseCaptcha,
  subscribeCloudBaseCaptcha,
  verifyCloudBaseCaptcha,
} from '../cloud/cloudbaseCaptcha'

export function CloudBaseCaptchaChallenge() {
  const challenge = useSyncExternalStore(
    subscribeCloudBaseCaptcha,
    getCloudBaseCaptchaSnapshot,
    getCloudBaseCaptchaSnapshot,
  )
  const [answer, setAnswer] = useState('')

  if (challenge.status === 'idle') return null

  const submit = async () => {
    if (await verifyCloudBaseCaptcha(answer)) setAnswer('')
  }

  const refresh = async () => {
    setAnswer('')
    await refreshCloudBaseCaptcha()
  }

  return (
    <section className="cloudbase-captcha" aria-label="CloudBase 人机验证" aria-busy={challenge.status === 'verifying'}>
      <div className="cloudbase-captcha__heading">
        <span aria-hidden="true">盾</span>
        <div><strong>再确认一下，是你在靠近</strong><small>只有触发风控时才会出现</small></div>
      </div>
      {challenge.imageData && <img src={challenge.imageData} alt="CloudBase 图片验证码" draggable={false} />}
      <div className="cloudbase-captcha__form">
        <label className="form-field">
          <span>输入图片中的字符</span>
          <input
            required
            autoFocus
            maxLength={12}
            autoComplete="off"
            inputMode="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>
        {challenge.message && <p className="cloud-form-error" role="alert">{challenge.message}</p>}
        <div className="cloudbase-captcha__actions">
          <button type="button" className="secondary-button" onClick={() => void refresh()}>换一张</button>
          <button type="button" className="primary-button" onClick={() => void submit()} disabled={!answer.trim() || challenge.status === 'verifying'}>
            {challenge.status === 'verifying' ? '正在验证…' : '完成验证'}
          </button>
        </div>
      </div>
    </section>
  )
}
