const STORAGE_KEY = '@linda-lim-pos/api-base-config'

export type ApiBaseConfig = {
  primary: string
  fallback: string
}

function getDesktopBridge() {
  if (typeof window === 'undefined' || !window.desktop?.isElectron) {
    return null
  }
  return window.desktop
}

async function migrateFromLocalStorage() {
  const desktop = getDesktopBridge()
  if (!desktop || typeof localStorage === 'undefined') {
    return
  }

  if (await desktop.apiBaseConfigExists()) {
    return
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return
  }

  try {
    const parsed = JSON.parse(raw) as ApiBaseConfig
    await desktop.saveApiBaseConfig(parsed)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore malformed legacy storage
  }
}

export async function loadApiBaseConfig(): Promise<ApiBaseConfig | null> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return null
  }

  await migrateFromLocalStorage()
  return desktop.loadApiBaseConfig()
}

export async function saveApiBaseConfig(config: ApiBaseConfig): Promise<void> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    throw new Error('Desktop API config bridge is not available.')
  }

  await desktop.saveApiBaseConfig(config)
}

export async function clearApiBaseConfig(): Promise<void> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return
  }

  await desktop.deleteApiBaseConfig()
}
