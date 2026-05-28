import type { PosConfig } from '../../types/config'
import * as electronConfigStore from './configStore.electron'
import { normalizePosConfig } from './terminalConfig'

const STORAGE_KEY = '@linda-lim-pos/config'

function useElectronConfigStore() {
  return typeof window !== 'undefined' && window.desktop?.isElectron === true
}

function readRaw(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return localStorage.getItem(STORAGE_KEY)
}

export async function configExists(): Promise<boolean> {
  if (useElectronConfigStore()) {
    return electronConfigStore.configExists()
  }

  return readRaw() !== null
}

export async function loadConfig(): Promise<PosConfig | null> {
  if (useElectronConfigStore()) {
    return electronConfigStore.loadConfig()
  }

  const raw = readRaw()

  if (!raw) {
    return null
  }

  return normalizePosConfig(JSON.parse(raw) as PosConfig)
}

export async function saveConfig(config: PosConfig): Promise<void> {
  if (useElectronConfigStore()) {
    await electronConfigStore.saveConfig(config)
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config, null, 2))
}

export async function deleteConfig(): Promise<void> {
  if (useElectronConfigStore()) {
    await electronConfigStore.deleteConfig()
    return
  }

  localStorage.removeItem(STORAGE_KEY)
}
