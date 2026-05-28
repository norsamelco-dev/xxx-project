import * as electronApiBaseConfig from './apiBaseConfig.electron'

const STORAGE_KEY = '@linda-lim-pos/api-base-config'

export type ApiBaseConfig = {
  primary: string
  fallback: string
}

function useElectronStore() {
  return typeof window !== 'undefined' && window.desktop?.isElectron === true
}

function readRaw(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return localStorage.getItem(STORAGE_KEY)
}

export async function loadApiBaseConfig(): Promise<ApiBaseConfig | null> {
  if (useElectronStore()) {
    return electronApiBaseConfig.loadApiBaseConfig()
  }

  const raw = readRaw()
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ApiBaseConfig
  } catch {
    return null
  }
}

export async function saveApiBaseConfig(config: ApiBaseConfig): Promise<void> {
  if (useElectronStore()) {
    await electronApiBaseConfig.saveApiBaseConfig(config)
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config, null, 2))
}

export async function clearApiBaseConfig(): Promise<void> {
  if (useElectronStore()) {
    await electronApiBaseConfig.clearApiBaseConfig()
    return
  }

  localStorage.removeItem(STORAGE_KEY)
}
