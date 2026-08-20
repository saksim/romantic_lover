import cloudbase from '@cloudbase/js-sdk'
import { backendConfig, getBackendConfigurationProblems } from '../config/backend'
import { configureCloudBaseCaptcha, installCloudBaseCaptchaAdapter } from './cloudbaseCaptcha'

export type CloudBaseApp = ReturnType<typeof cloudbase.init>

export interface CloudBaseClientState {
  app: CloudBaseApp | null
  enabled: boolean
  issue?: string
}

let singleton: CloudBaseApp | undefined

export function getCloudBaseClientState(): CloudBaseClientState {
  if (backendConfig.provider !== 'cloudbase-pg') {
    return { app: null, enabled: false }
  }

  const problems = getBackendConfigurationProblems(backendConfig)
  if (problems.length) {
    return { app: null, enabled: true, issue: problems.join(' ') }
  }

  if (!singleton) {
    installCloudBaseCaptchaAdapter(cloudbase)
    singleton = cloudbase.init({
      env: backendConfig.cloudbase.envId!,
      region: backendConfig.cloudbase.region,
      accessKey: backendConfig.cloudbase.publishableKey!,
      timeout: 15_000,
      persistence: 'local',
      auth: {
        detectSessionInUrl: true,
      },
    })
    configureCloudBaseCaptcha({
      auth: singleton.auth,
      parseCaptcha: (url) => singleton!.parseCaptcha(url),
    })
  }

  return { app: singleton, enabled: true }
}
