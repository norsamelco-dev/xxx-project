import type { AuditMeta } from './audit'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    // In dev, force same-origin API requests so Vite proxy handles backend routing.
    // This avoids cross-origin cookie/session pitfalls that cause immediate 401 after login.
    return ''
  }

  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (configured) {
    return normalizeBaseUrl(configured)
  }

  // Default to same-origin paths in browser contexts to keep session cookies stable.
  return ''
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

export type ApiFetchInit = RequestInit & {
  audit?: AuditMeta
}

export async function apiFetch<T>(input: string, init: ApiFetchInit = {}): Promise<T> {
  const { audit, ...requestInit } = init
  const headers = new Headers(requestInit.headers || {})
  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData
  const apiBaseUrl = getApiBaseUrl()
  const requestUrl = resolveApiUrl(input, apiBaseUrl)

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

  return payload as T
}