import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { backendConfig, getBackendConfigurationProblems } from '../config/backend'

export interface SupabaseClientState {
  client: SupabaseClient | null
  enabled: boolean
  issue?: string
}

let singleton: SupabaseClient | undefined

export function getSupabaseClientState(): SupabaseClientState {
  if (backendConfig.provider !== 'supabase') {
    return { client: null, enabled: false }
  }

  const problems = getBackendConfigurationProblems(backendConfig)
  if (problems.length) {
    return { client: null, enabled: true, issue: problems.join(' ') }
  }

  const url = backendConfig.supabase.url!
  const publishableKey = backendConfig.supabase.publishableKey!
  if (!publishableKey.startsWith('sb_publishable_')) {
    return {
      client: null,
      enabled: true,
      issue: 'VITE_SUPABASE_PUBLISHABLE_KEY must use a browser-safe sb_publishable_ key.',
    }
  }

  singleton ??= createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'future-with-you.supabase.auth',
    },
    global: {
      headers: { 'X-Client-Info': 'future-with-you/0.5-alpha2' },
    },
  })

  return { client: singleton, enabled: true }
}
