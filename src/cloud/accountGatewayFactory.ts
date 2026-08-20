import { backendConfig, getBackendConfigurationProblems, type BackendProvider } from '../config/backend'
import type { AuthGateway, CoupleGateway } from '../sync/SyncGateway'

export type AccountGateway = AuthGateway & CoupleGateway

export interface AccountGatewayBootstrapState {
  provider: BackendProvider
  enabled: boolean
  issue?: string
}

export function getAccountGatewayBootstrapState(): AccountGatewayBootstrapState {
  if (backendConfig.provider === 'local') {
    return { provider: 'local', enabled: false }
  }
  const problems = getBackendConfigurationProblems(backendConfig)
  return {
    provider: backendConfig.provider,
    enabled: true,
    issue: problems.length ? problems.join(' ') : undefined,
  }
}

export async function loadAccountGateway(): Promise<AccountGateway | null> {
  if (backendConfig.provider === 'supabase') {
    const [{ getSupabaseClientState }, { SupabaseAccountGateway }] = await Promise.all([
      import('./supabaseClient'),
      import('./SupabaseAccountGateway'),
    ])
    const state = getSupabaseClientState()
    if (state.issue) throw new Error(state.issue)
    if (!state.client) return null
    return new SupabaseAccountGateway(state.client)
  }

  if (backendConfig.provider === 'cloudbase-pg') {
    const [{ getCloudBaseClientState }, { CloudBaseAccountGateway }] = await Promise.all([
      import('./cloudbaseClient'),
      import('./CloudBaseAccountGateway'),
    ])
    const state = getCloudBaseClientState()
    if (state.issue) throw new Error(state.issue)
    if (!state.app) return null
    return new CloudBaseAccountGateway(state.app)
  }

  return null
}
