export type BackendProvider = 'local' | 'cloudbase-pg' | 'supabase'

export interface BackendConfig {
  provider: BackendProvider
  cloudbase: {
    envId?: string
    publishableKey?: string
    region: string
  }
  supabase: {
    url?: string
    publishableKey?: string
  }
}

function optional(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function readProvider(value: string | undefined): BackendProvider {
  if (value === 'cloudbase-pg' || value === 'supabase') return value
  return 'local'
}

export const backendConfig: Readonly<BackendConfig> = Object.freeze({
  provider: readProvider(optional(import.meta.env.VITE_BACKEND_PROVIDER)),
  cloudbase: {
    envId: optional(import.meta.env.VITE_CLOUDBASE_ENV_ID),
    publishableKey: optional(import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY),
    region: optional(import.meta.env.VITE_CLOUDBASE_REGION) ?? 'ap-shanghai',
  },
  supabase: {
    url: optional(import.meta.env.VITE_SUPABASE_URL),
    publishableKey: optional(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  },
})

export function getBackendConfigurationProblems(config: BackendConfig = backendConfig): string[] {
  if (config.provider === 'cloudbase-pg') {
    return [
      !config.cloudbase.envId ? 'VITE_CLOUDBASE_ENV_ID is required.' : '',
      !config.cloudbase.publishableKey ? 'VITE_CLOUDBASE_PUBLISHABLE_KEY is required.' : '',
    ].filter(Boolean)
  }

  if (config.provider === 'supabase') {
    return [
      !config.supabase.url ? 'VITE_SUPABASE_URL is required.' : '',
      !config.supabase.publishableKey
        ? 'VITE_SUPABASE_PUBLISHABLE_KEY is required.'
        : !config.supabase.publishableKey.startsWith('sb_publishable_') ? 'Only an sb_publishable_ key is allowed in the browser.' : '',
    ].filter(Boolean)
  }

  return []
}
