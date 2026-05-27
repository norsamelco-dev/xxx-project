import type { AuditMeta } from './audit'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

const PRIMARY_API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || 'https://pos-api.lindalim.shop',
)
const FALLBACK_API_BASE_URL = import.meta.env.VITE_API_BASE_URL_LOCAL
  ? normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL_LOCAL)
  : ''

function getApiBaseUrls(): string[] {
  const urls = [PRIMARY_API_BASE_URL]
  if (FALLBACK_API_BASE_URL && FALLBACK_API_BASE_URL !== PRIMARY_API_BASE_URL) {
    urls.push(FALLBACK_API_BASE_URL)
  }
  return urls
}

let activeApiBaseUrl: string | null = null

function resolveApiUrl(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError
}

async function fetchWithBaseUrlFallback(path: string, init: RequestInit): Promise<Response> {
  const baseUrls = getApiBaseUrls()
  const tryOrder = activeApiBaseUrl
    ? [activeApiBaseUrl, ...baseUrls.filter((url) => url !== activeApiBaseUrl)]
    : baseUrls

  let lastError: unknown

  for (const baseUrl of tryOrder) {
    try {
      const response = await fetch(resolveApiUrl(path, baseUrl), init)
      activeApiBaseUrl = baseUrl
      return response
    } catch (error) {
      lastError = error
      if (activeApiBaseUrl === baseUrl) {
        activeApiBaseUrl = null
      }
      if (!isNetworkFailure(error) || baseUrl === tryOrder[tryOrder.length - 1]) {
        throw error
      }
    }
  }

  throw lastError
}

export type ApiFetchInit = RequestInit & {
  audit?: AuditMeta
}

export async function apiFetch<T>(input: string, init: ApiFetchInit = {}): Promise<T> {
  const { audit, ...requestInit } = init
  const headers = new Headers(requestInit.headers || {})
  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData

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

  const response = await fetchWithBaseUrlFallback(input, {
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
    throw error
  }

  return payload as T
}