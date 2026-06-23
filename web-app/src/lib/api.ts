import type { AuditMeta } from './audit'

export type ApiMode = 'online' | 'offline' | 'proxy'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function readEnvUrl(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? normalizeBaseUrl(value.trim()) : ''
}

function getConfiguredOnlineUrl(): string {
  return readEnvUrl('VITE_API_ONLINE_BASE_URL') || readEnvUrl('VITE_API_BASE_URL')
}

function getConfiguredOfflineUrl(): string {
  return readEnvUrl('VITE_API_OFFLINE_BASE_URL')
}

function usesDirectApiUrls(): boolean {
  return Boolean(getConfiguredOnlineUrl() || getConfiguredOfflineUrl())
}

function getApiBaseUrls(): string[] {
  const urls: string[] = []
  const online = getConfiguredOnlineUrl()
  const offline = getConfiguredOfflineUrl()

  if (online) {
    urls.push(online)
  }

  if (offline && offline !== online) {
    urls.push(offline)
  }

  return urls
}

let activeApiBaseUrl: string | null = null
let lastFailoverBaseUrl: string | null = null

type ApiModeChangeHandler = () => void
const apiModeChangeHandlers = new Set<ApiModeChangeHandler>()

function notifyApiModeChange() {
  apiModeChangeHandlers.forEach((handler) => {
    try {
      handler()
    } catch (_error) {
      // Ignore subscriber failures.
    }
  })
}

export function onApiModeChange(handler: ApiModeChangeHandler): () => void {
  apiModeChangeHandlers.add(handler)
  return () => {
    apiModeChangeHandlers.delete(handler)
  }
}

function getTryOrder(): string[] {
  const baseUrls = getApiBaseUrls()

  if (!usesDirectApiUrls()) {
    return ['']
  }

  if (activeApiBaseUrl) {
    return [activeApiBaseUrl, ...baseUrls.filter((url) => url !== activeApiBaseUrl)]
  }

  return baseUrls
}

export function getApiBaseUrl(): string {
  if (!usesDirectApiUrls()) {
    return ''
  }

  return activeApiBaseUrl ?? getApiBaseUrls()[0] ?? ''
}

export function getActiveApiMode(): ApiMode {
  if (!usesDirectApiUrls()) {
    return 'proxy'
  }

  const active = getApiBaseUrl()
  const offline = getConfiguredOfflineUrl()

  if (offline && active === offline) {
    return 'offline'
  }

  return 'online'
}

export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null
  }

  if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path
  }

  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    return path.startsWith('/') ? path : `/${path}`
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

type UnauthorizedHandler = () => void
const unauthorizedHandlers = new Set<UnauthorizedHandler>()
let isNotifyingUnauthorized = false

function notifyUnauthorized() {
  if (isNotifyingUnauthorized) {
    return
  }
  isNotifyingUnauthorized = true
  try {
    unauthorizedHandlers.forEach((handler) => {
      try {
        handler()
      } catch (_error) {
        // Ignore subscriber failures so one handler does not break others.
      }
    })
  } finally {
    isNotifyingUnauthorized = false
  }
}

export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler)
  return () => {
    unauthorizedHandlers.delete(handler)
  }
}

function resolveApiUrl(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  if (!baseUrl) {
    return path.startsWith('/') ? path : `/${path}`
  }
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false
  }

  const message = String(error.message || '').toLowerCase()
  return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')
}

function markSuccessfulBase(baseUrl: string) {
  const previousMode = getActiveApiMode()
  activeApiBaseUrl = baseUrl || null
  lastFailoverBaseUrl = null

  if (getActiveApiMode() !== previousMode) {
    notifyApiModeChange()
  }
}

function markFailover(fromBaseUrl: string, toBaseUrl: string) {
  if (activeApiBaseUrl === fromBaseUrl) {
    activeApiBaseUrl = null
  }

  if (lastFailoverBaseUrl !== toBaseUrl) {
    lastFailoverBaseUrl = toBaseUrl
    notifyUnauthorized()
    notifyApiModeChange()
  }
}

export type ApiFetchInit = RequestInit & {
  audit?: AuditMeta
}

async function executeApiFetch<T>(
  input: string,
  init: ApiFetchInit,
  baseUrl: string,
): Promise<T> {
  const { audit, ...requestInit } = init
  const headers = new Headers(requestInit.headers || {})
  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData
  const requestUrl = resolveApiUrl(input, baseUrl)

  if (requestInit.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (audit) {
    headers.set('x-audit-page', audit.page.slice(0, 255))
    headers.set('x-audit-action', audit.action.slice(0, 255))
    headers.set('x-audit-description', audit.description.slice(0, 2000))
    if (audit.tableName) {
      headers.set('x-audit-table', audit.tableName.slice(0, 255))
    }
    if (audit.productBarcode) {
      headers.set('x-audit-barcode', audit.productBarcode.slice(0, 255))
    }
  }

  const response = await fetch(requestUrl, {
    ...requestInit,
    headers,
    credentials: 'include',
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = payload?.error || 'Request failed.'
    const error = new Error(message) as Error & { status?: number }
    if (payload && typeof payload === 'object') {
      Object.assign(error, payload)
    }
    error.status = response.status
    if (response.status === 401 && input !== '/api/auth/login') {
      notifyUnauthorized()
    }
    throw error
  }

  markSuccessfulBase(baseUrl)
  return payload as T
}

export async function apiFetch<T>(input: string, init: ApiFetchInit = {}): Promise<T> {
  const tryOrder = getTryOrder()
  let lastNetworkError: unknown = null

  for (let index = 0; index < tryOrder.length; index += 1) {
    const baseUrl = tryOrder[index]

    try {
      return await executeApiFetch<T>(input, init, baseUrl)
    } catch (error) {
      if (!isNetworkFailure(error)) {
        throw error
      }

      lastNetworkError = error

      const nextBaseUrl = tryOrder[index + 1]
      if (nextBaseUrl !== undefined) {
        markFailover(baseUrl, nextBaseUrl)
        continue
      }
    }
  }

  throw lastNetworkError instanceof Error ? lastNetworkError : new Error('Unable to reach the API server.')
}
