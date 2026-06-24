import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { Platform } from 'react-native'

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  __fallbackIndex?: number
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const DEFAULT_PRIMARY_API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_POS_API_URL || 'https://pos-api.lindalim.shop',
)

function defaultLocalFallback(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000'
  }

  return 'http://127.0.0.1:5000'
}

function resolveLocalFallbackUrl(url: string): string {
  if (Platform.OS === 'android' && /localhost|127\.0\.0\.1/.test(url)) {
    return url.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2')
  }

  return url
}

const DEFAULT_FALLBACK_API_BASE_URL = resolveLocalFallbackUrl(
  process.env.EXPO_PUBLIC_POS_API_URL_LOCAL
    ? normalizeBaseUrl(process.env.EXPO_PUBLIC_POS_API_URL_LOCAL)
    : defaultLocalFallback(),
)

let configuredPrimaryApiBaseUrl = DEFAULT_PRIMARY_API_BASE_URL
let configuredFallbackApiBaseUrl = DEFAULT_FALLBACK_API_BASE_URL

function getApiBaseUrls(): string[] {
  const urls = [configuredPrimaryApiBaseUrl]

  if (configuredFallbackApiBaseUrl && configuredFallbackApiBaseUrl !== configuredPrimaryApiBaseUrl) {
    urls.push(configuredFallbackApiBaseUrl)
  }

  return urls
}

let activeApiBaseUrl: string | null = null
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null
let onConnectionError: ((details: { source: string; url?: string; message?: string }) => void) | null = null
let onConnectionRecovered: (() => void) | null = null

function getTryOrder(): string[] {
  const baseUrls = getApiBaseUrls()

  if (activeApiBaseUrl) {
    return [activeApiBaseUrl, ...baseUrls.filter((url) => url !== activeApiBaseUrl)]
  }

  return baseUrls
}

function isNetworkFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const axiosError = error as AxiosError
  return !axiosError.response
}

export const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-POS-Client': 'mobile',
  },
})

apiClient.interceptors.request.use((config: RetryableRequestConfig) => {
  const tryOrder = getTryOrder()
  const index = typeof config.__fallbackIndex === 'number' ? config.__fallbackIndex : 0
  config.baseURL = tryOrder[index] ?? tryOrder[0]

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => {
    if (response.config.baseURL) {
      activeApiBaseUrl = response.config.baseURL
    }
    onConnectionRecovered?.()

    return response
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined

    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized()
    }

    if (config && isNetworkFailure(error)) {
      const tryOrder = getTryOrder()
      const currentIndex = typeof config.__fallbackIndex === 'number' ? config.__fallbackIndex : 0

      if (currentIndex < tryOrder.length - 1) {
        const failedBaseUrl = config.baseURL

        if (activeApiBaseUrl === failedBaseUrl) {
          activeApiBaseUrl = null
        }

        config.__fallbackIndex = currentIndex + 1
        return apiClient.request(config)
      }

      onConnectionError?.({
        source: 'api-client',
        url: config.baseURL,
        message: error.message,
      })
    }

    const message =
      (error.response?.data as { error?: string } | undefined)?.error ||
      error.message ||
      'Request failed'

    return Promise.reject(new Error(message))
  },
)

export function setAuthToken(token: string | null) {
  authToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export function setConnectionErrorHandler(
  handler: ((details: { source: string; url?: string; message?: string }) => void) | null,
) {
  onConnectionError = handler
}

export function setConnectionRecoveredHandler(handler: (() => void) | null) {
  onConnectionRecovered = handler
}

export function setApiBaseUrlOverrides(urls: { primary: string; fallback?: string }) {
  configuredPrimaryApiBaseUrl = normalizeBaseUrl(urls.primary)
  const fallback = typeof urls.fallback === 'string' ? normalizeBaseUrl(urls.fallback) : ''
  configuredFallbackApiBaseUrl = fallback ? resolveLocalFallbackUrl(fallback) : ''
  activeApiBaseUrl = null
}

export function getApiBaseUrlOverrides() {
  return {
    primary: configuredPrimaryApiBaseUrl,
    fallback: configuredFallbackApiBaseUrl,
  }
}

export async function testApiBaseUrl(url: string): Promise<void> {
  await axios.get(`${normalizeBaseUrl(url)}/api/branches/public`, {
    timeout: 10000,
  })
}

export function getApiBaseUrl() {
  return activeApiBaseUrl ?? getApiBaseUrls()[0]
}

export function getApiBaseUrlsForDebug() {
  return getApiBaseUrls()
}
