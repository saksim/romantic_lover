import { CloudBaseWebRequest } from './cloudbaseWebRequest'

interface CloudBaseAdapterHost {
  useAdapters(adapter: unknown): unknown
}

export type CloudBaseCaptchaStatus = 'idle' | 'waiting' | 'verifying' | 'error'

export interface CloudBaseCaptchaState {
  status: CloudBaseCaptchaStatus
  imageData?: string
  state?: string
  token?: string
  message?: string
}

interface CaptchaToken {
  captcha_token: string
  expires_in: number
  expires_at?: Date | null
}

interface CaptchaParserResult {
  captchaData?: string
  state?: string
  token?: string
}

interface CloudBaseCaptchaAuth {
  createCaptchaData(params: { state: string }): Promise<unknown>
  verifyCaptchaData(params: { token: string; key: string }): Promise<unknown>
}

interface CloudBaseCaptchaRuntime {
  auth: CloudBaseCaptchaAuth
  parseCaptcha(url: string): CaptchaParserResult
}

interface PendingCaptcha {
  resolve(token: CaptchaToken): void
  reject(error: Error): void
}

const IDLE_STATE: CloudBaseCaptchaState = Object.freeze({ status: 'idle' })
const listeners = new Set<() => void>()
let snapshot = IDLE_STATE
let runtime: CloudBaseCaptchaRuntime | undefined
let pending: PendingCaptcha | undefined
let adapterInstalled = false

const fallbackStorage = new Map<string, string>()
const resilientLocalStorage = {
  mode: 'sync' as const,
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key) ?? fallbackStorage.get(key) ?? null
    } catch {
      return fallbackStorage.get(key) ?? null
    }
  },
  setItem(key: string, value: string) {
    fallbackStorage.set(key, value)
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Private browsing can reject writes; the in-memory copy keeps Auth usable.
    }
  },
  removeItem(key: string) {
    fallbackStorage.delete(key)
    try {
      window.localStorage.removeItem(key)
    } catch {
      // The fallback has already been cleared.
    }
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function publish(next: CloudBaseCaptchaState) {
  snapshot = Object.freeze(next)
  listeners.forEach((listener) => listener())
}

function createCaptchaCancelledError() {
  const error = new Error('CloudBase CAPTCHA was cancelled.') as Error & { code: string }
  error.code = 'captcha_cancelled'
  return error
}

function readError(result: unknown) {
  if (!isRecord(result)) return undefined
  return result.error || undefined
}

function readCaptchaToken(result: unknown): CaptchaToken | undefined {
  if (!isRecord(result)) return undefined
  const candidate = isRecord(result.data) ? result.data : result
  if (typeof candidate.captcha_token !== 'string') return undefined
  return {
    captcha_token: candidate.captcha_token,
    expires_in: typeof candidate.expires_in === 'number' ? candidate.expires_in : 300,
    expires_at: candidate.expires_at instanceof Date ? candidate.expires_at : null,
  }
}

async function openCaptcha(url: string): Promise<CaptchaToken> {
  if (!runtime) throw new Error('CloudBase CAPTCHA runtime is not ready.')
  pending?.reject(createCaptchaCancelledError())

  const parsed = runtime.parseCaptcha(url)
  if (!parsed.captchaData || !parsed.state || !parsed.token) {
    throw new Error('CloudBase CAPTCHA response is incomplete.')
  }

  publish({
    status: 'waiting',
    imageData: parsed.captchaData,
    state: parsed.state,
    token: parsed.token,
  })

  return new Promise<CaptchaToken>((resolve, reject) => {
    pending = { resolve, reject }
  })
}

export function installCloudBaseCaptchaAdapter(host: CloudBaseAdapterHost) {
  if (adapterInstalled) return
  adapterInstalled = true
  host.useAdapters({
    runtime: 'web',
    isMatch: () => typeof window !== 'undefined',
    genAdapter: () => ({
      root: window,
      reqClass: CloudBaseWebRequest,
      wsClass: window.WebSocket,
      localStorage: resilientLocalStorage,
      primaryStorage: 'local',
      captchaOptions: { openURIWithCallback: openCaptcha },
    }),
  })
}

export function configureCloudBaseCaptcha(nextRuntime: CloudBaseCaptchaRuntime) {
  runtime = nextRuntime
}

export function subscribeCloudBaseCaptcha(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCloudBaseCaptchaSnapshot() {
  return snapshot
}

export async function verifyCloudBaseCaptcha(answer: string) {
  const normalizedAnswer = answer.trim()
  if (!runtime || !pending || !snapshot.token || !normalizedAnswer) return false

  publish({ ...snapshot, status: 'verifying', message: undefined })
  try {
    const result = await runtime.auth.verifyCaptchaData({ token: snapshot.token, key: normalizedAnswer })
    const error = readError(result)
    if (error) throw error
    const captchaToken = readCaptchaToken(result)
    if (!captchaToken) throw new Error('CloudBase CAPTCHA verification response is incomplete.')

    const current = pending
    pending = undefined
    publish(IDLE_STATE)
    current.resolve(captchaToken)
    return true
  } catch {
    publish({ ...snapshot, status: 'error', message: '验证码不正确或已经过期，请刷新后重试。' })
    return false
  }
}

export async function refreshCloudBaseCaptcha() {
  if (!runtime || !snapshot.state) return false
  try {
    const result = await runtime.auth.createCaptchaData({ state: snapshot.state })
    const error = readError(result)
    if (error) throw error
    const candidate = isRecord(result) && isRecord(result.data) ? result.data : result
    const imageData = isRecord(candidate) && typeof candidate.data === 'string'
      ? candidate.data
      : isRecord(result) && typeof result.data === 'string' ? result.data : undefined
    const token = isRecord(candidate) && typeof candidate.token === 'string'
      ? candidate.token
      : isRecord(result) && typeof result.token === 'string' ? result.token : undefined
    if (!imageData || !token) throw new Error('CloudBase CAPTCHA refresh response is incomplete.')
    publish({ status: 'waiting', imageData, state: snapshot.state, token })
    return true
  } catch {
    publish({ ...snapshot, status: 'error', message: '验证码刷新失败，请稍后重试。' })
    return false
  }
}

export function cancelCloudBaseCaptcha() {
  const current = pending
  pending = undefined
  publish(IDLE_STATE)
  current?.reject(createCaptchaCancelledError())
}
