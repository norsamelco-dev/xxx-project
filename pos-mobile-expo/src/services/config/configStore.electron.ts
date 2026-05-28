import type { PosConfig } from '../../types/config'
import { normalizePosConfig } from './terminalConfig'

const STORAGE_KEY = '@linda-lim-pos/config'

function getDesktopBridge() {
  if (typeof window === 'undefined' || !window.desktop?.isElectron) {
    return null
  }
  return window.desktop
}

async function migrateDesktopConfigFromLocalStorage() {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return
  }

  if (await desktop.configExists()) {
    return
  }

  if (typeof localStorage === 'undefined') {
    return
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return
  }

  try {
    const parsed = normalizePosConfig(JSON.parse(raw) as PosConfig)
    await desktop.saveConfig(parsed)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore invalid legacy config
  }
}

export async function configExists(): Promise<boolean> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return false
  }

  await migrateDesktopConfigFromLocalStorage()
  return desktop.configExists()
}

export async function loadConfig(): Promise<PosConfig | null> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return null
  }

  await migrateDesktopConfigFromLocalStorage()
  const config = await desktop.loadConfig()
  return config ? normalizePosConfig(config) : null
}

export async function saveConfig(config: PosConfig): Promise<void> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    throw new Error('Desktop config bridge is not available.')
  }

  await desktop.saveConfig(config)
}

export async function deleteConfig(): Promise<void> {
  const desktop = getDesktopBridge()
  if (!desktop) {
    return
  }

  await desktop.deleteConfig()
}
