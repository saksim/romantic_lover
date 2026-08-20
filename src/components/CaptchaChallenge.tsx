import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { CaptchaClientConfig } from '../cloud/captchaConfig'

const HCaptchaWidget = lazy(() => import('@hcaptcha/react-hcaptcha'))
const TurnstileWidget = lazy(async () => {
  const module = await import('@marsidev/react-turnstile')
  return { default: module.Turnstile }
})

type ChallengeStatus = 'waiting' | 'verified' | 'expired' | 'error'

interface CaptchaChallengeProps {
  config: CaptchaClientConfig
  resetKey: number
  onTokenChange: (token?: string) => void
}

const STATUS_COPY: Record<ChallengeStatus, string> = {
  waiting: '请完成人机验证，验证成功后才能提交。',
  verified: '验证完成，可以继续。',
  expired: '验证已过期，请重新完成。',
  error: '验证码没有加载成功，请检查网络后重试。',
}

export function CaptchaChallenge({ config, resetKey, onTokenChange }: CaptchaChallengeProps) {
  const [status, setStatus] = useState<ChallengeStatus>('waiting')
  const compact = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 350px)').matches,
    [],
  )

  useEffect(() => {
    setStatus('waiting')
    onTokenChange(undefined)
  }, [onTokenChange, resetKey])

  const handleVerified = useCallback((token: string) => {
    setStatus('verified')
    onTokenChange(token)
  }, [onTokenChange])

  const handleExpired = useCallback(() => {
    setStatus('expired')
    onTokenChange(undefined)
  }, [onTokenChange])

  const handleError = useCallback(() => {
    setStatus('error')
    onTokenChange(undefined)
  }, [onTokenChange])

  if (!config.enabled) return null

  if (config.issue || !config.provider || !config.siteKey) {
    return <p className="cloud-captcha-issue" role="alert">{config.issue ?? '验证码配置尚未完成。'}</p>
  }

  return (
    <section className={`cloud-captcha is-${status}`} aria-label="人机验证">
      <div className={`cloud-captcha__widget cloud-captcha__widget--${config.provider}`}>
        <Suspense fallback={<span className="cloud-captcha__loading">正在准备验证…</span>}>
          {config.provider === 'hcaptcha' ? (
            <HCaptchaWidget
              key={`hcaptcha-${resetKey}`}
              sitekey={config.siteKey}
              size={compact ? 'compact' : 'normal'}
              theme="light"
              languageOverride="zh-CN"
              onVerify={handleVerified}
              onExpire={handleExpired}
              onError={handleError}
            />
          ) : (
            <TurnstileWidget
              key={`turnstile-${resetKey}`}
              siteKey={config.siteKey}
              onSuccess={handleVerified}
              onExpire={handleExpired}
              onError={handleError}
              onTimeout={handleExpired}
              onUnsupported={handleError}
              options={{
                appearance: 'always',
                language: 'zh-CN',
                refreshExpired: 'auto',
                refreshTimeout: 'auto',
                size: compact ? 'compact' : 'flexible',
                theme: 'light',
              }}
            />
          )}
        </Suspense>
      </div>
      <p className="cloud-captcha__status" aria-live="polite">{STATUS_COPY[status]}</p>
    </section>
  )
}
