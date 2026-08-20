import {
  AbstractSDKRequest,
  type IFetchOptions,
  type IRequestConfig,
  type IRequestOptions,
  type IUploadRequestOptions,
  type ResponseObject,
} from '@cloudbase/adapter-interface'

type RestrictedMethod = 'get' | 'post' | 'put' | 'upload' | 'download' | 'request'
type CloudBaseFetchOptions = IFetchOptions & { shouldThrowOnError?: boolean }

interface CloudBaseTransportError {
  error: 'request_timeout' | 'request_cancelled' | 'unreachable'
  code: 'request_timeout' | 'request_cancelled' | 'unreachable'
  error_description: string
  message: string
}

function transportError(
  code: CloudBaseTransportError['code'],
  message: string,
): CloudBaseTransportError {
  return { error: code, code, error_description: message, message }
}

function requestUrl(value: string | undefined, data?: object) {
  if (!value) throw transportError('unreachable', 'CloudBase request URL is missing.')
  const base = typeof window === 'undefined' ? 'https://localhost/' : window.location.href
  const url = new URL(value, base)
  if (data) {
    Object.entries(data).forEach(([key, entry]) => {
      if (entry === undefined || entry === null) return
      url.searchParams.append(key, typeof entry === 'string' ? entry : String(entry))
    })
  }
  return url.toString()
}

function hasHeader(headers: Headers, name: string) {
  return headers.has(name) || headers.has(name.toLowerCase())
}

function requestBody(options: IRequestOptions, headers: Headers): BodyInit | undefined {
  if (options.body !== undefined && options.body !== null) return options.body as BodyInit
  const data = options.data
  if (data === undefined || data === null) return undefined
  if (
    typeof data === 'string'
    || data instanceof FormData
    || data instanceof Blob
    || data instanceof ArrayBuffer
    || ArrayBuffer.isView(data)
    || data instanceof URLSearchParams
  ) {
    return data as BodyInit
  }
  if (headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.append(key, String(value))
    })
    return params
  }
  if (!hasHeader(headers, 'content-type')) headers.set('content-type', 'application/json')
  return JSON.stringify(data)
}

async function responseData(response: Response, responseType?: XMLHttpRequestResponseType, stream = false) {
  if (stream) return response.body
  if (responseType === 'blob') return response.blob()
  if (responseType === 'arraybuffer') return response.arrayBuffer()
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/**
 * The custom CAPTCHA adapter must also provide the browser transport that it
 * replaces in CloudBase. Keeping this request class here prevents Auth calls
 * from falling back to an unbounded raw fetch when a carrier, CORS preflight,
 * or the CloudBase endpoint stops responding.
 */
export class CloudBaseWebRequest extends AbstractSDKRequest {
  private readonly timeoutMs: number
  private readonly restrictedMethods: RestrictedMethod[]

  constructor(config: Omit<IRequestConfig, 'restrictedMethods'> & { restrictedMethods?: RestrictedMethod[] } = {}) {
    super()
    this.timeoutMs = config.timeout ?? 15_000
    this.restrictedMethods = config.restrictedMethods ?? ['get', 'post', 'put', 'upload', 'download', 'request']
  }

  get(options: IRequestOptions) {
    return this.request({ ...options, method: 'GET' }, this.restrictedMethods.includes('get'))
  }

  post(options: IRequestOptions) {
    return this.request({ ...options, method: 'POST' }, this.restrictedMethods.includes('post'))
  }

  put(options: IRequestOptions) {
    return this.request({ ...options, method: 'PUT' }, this.restrictedMethods.includes('put'))
  }

  upload(options: IUploadRequestOptions) {
    const method = options.method?.toUpperCase() === 'POST' ? 'POST' : 'PUT'
    if (method === 'PUT') {
      return this.request({ ...options, method, body: options.file }, this.restrictedMethods.includes('upload'))
    }
    const form = new FormData()
    Object.entries(options.data ?? {}).forEach(([key, value]) => form.append(key, String(value)))
    form.append('key', options.name)
    form.append('file', options.file)
    return this.request({ ...options, method, data: form, body: undefined }, this.restrictedMethods.includes('upload'))
  }

  download(options: IRequestOptions) {
    return this.request({ ...options, method: 'GET', responseType: 'blob' }, this.restrictedMethods.includes('download'))
  }

  async fetch(options: CloudBaseFetchOptions): Promise<ResponseObject> {
    const { url, enableAbort, stream = false, timeout, shouldThrowOnError = true, ...requestInit } = options
    void enableAbort
    return this.perform(
      url,
      requestInit as RequestInit,
      stream,
      undefined,
      timeout ?? this.timeoutMs,
      shouldThrowOnError,
    )
  }

  private async request(options: IRequestOptions, enforceTimeout: boolean): Promise<ResponseObject> {
    const method = (options.method ?? 'GET').toUpperCase()
    const headers = new Headers(options.headers as HeadersInit | undefined)
    const url = requestUrl(options.url, method === 'GET' ? options.data : undefined)
    const body = method === 'GET' || method === 'HEAD' ? undefined : requestBody(options, headers)
    return this.perform(url, {
      method,
      headers,
      body,
      credentials: options.withCredentials ? 'include' : 'same-origin',
    }, false, options.responseType, enforceTimeout ? this.timeoutMs : undefined)
  }

  private async perform(
    url: string,
    init: RequestInit,
    stream: boolean,
    responseType?: XMLHttpRequestResponseType,
    timeoutMs?: number,
    rejectHttpErrors = false,
  ): Promise<ResponseObject> {
    const controller = new AbortController()
    const externalSignal = init.signal
    let timedOut = false
    const forwardAbort = () => controller.abort()
    if (externalSignal?.aborted) controller.abort()
    else externalSignal?.addEventListener('abort', forwardAbort, { once: true })
    const timeoutId = timeoutMs && timeoutMs > 0
      ? window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      : undefined

    let response: Response
    try {
      response = await globalThis.fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (timedOut) {
        throw transportError('request_timeout', 'CloudBase did not respond before the request deadline.')
      }
      if (externalSignal?.aborted) {
        throw transportError('request_cancelled', 'CloudBase request was cancelled.')
      }
      const message = error instanceof Error && error.message
        ? `CloudBase network request failed: ${error.message}`
        : 'CloudBase network request failed.'
      throw transportError('unreachable', message)
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', forwardAbort)
    }

    const data = await responseData(response, responseType, stream)
    if (rejectHttpErrors && !response.ok) {
      if (data && typeof data === 'object') throw data
      throw {
        code: `http_${response.status}`,
        error: `http_${response.status}`,
        error_description: typeof data === 'string' && data ? data : `CloudBase returned HTTP ${response.status}.`,
      }
    }
    return {
      data,
      statusCode: response.status,
      header: response.headers,
      response,
    }
  }
}
