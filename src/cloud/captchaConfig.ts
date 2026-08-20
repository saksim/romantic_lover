export type CaptchaProvider = 'hcaptcha' | 'turnstile'

export interface CaptchaClientConfig {
  enabled: boolean
  provider?: CaptchaProvider
  siteKey?: string
  issue?: string
}

export function getCaptchaClientConfig(): CaptchaClientConfig {
  const providerValue = import.meta.env.VITE_SUPABASE_CAPTCHA_PROVIDER?.trim().toLowerCase() ?? ''
  const siteKey = import.meta.env.VITE_SUPABASE_CAPTCHA_SITE_KEY?.trim() ?? ''

  if (!providerValue && !siteKey) return { enabled: false }

  if (providerValue !== 'hcaptcha' && providerValue !== 'turnstile') {
    return {
      enabled: true,
      issue: '验证码供应商配置不正确，请使用 hcaptcha 或 turnstile。',
    }
  }

  if (!siteKey) {
    return {
      enabled: true,
      provider: providerValue,
      issue: '验证码缺少公开 Site Key，请由空间创建者完成 Vercel 配置。',
    }
  }

  return {
    enabled: true,
    provider: providerValue,
    siteKey,
  }
}
