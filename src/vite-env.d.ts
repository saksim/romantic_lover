/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_RELEASE_LABEL__: string

interface ImportMetaEnv {
  readonly VITE_BACKEND_PROVIDER?: 'local' | 'cloudbase-pg' | 'supabase'
  readonly VITE_CLOUDBASE_ENV_ID?: string
  readonly VITE_CLOUDBASE_PUBLISHABLE_KEY?: string
  readonly VITE_CLOUDBASE_REGION?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_CAPTCHA_PROVIDER?: 'hcaptcha' | 'turnstile'
  readonly VITE_SUPABASE_CAPTCHA_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
