import type { PosConfig } from './config'

export type DesktopBridge = {
  isElectron: boolean
  platform: string
  version: string
  configPath: string
  configExists: () => Promise<boolean>
  loadConfig: () => Promise<PosConfig | null>
  saveConfig: (config: PosConfig) => Promise<void>
  deleteConfig: () => Promise<void>
  apiBaseConfigExists: () => Promise<boolean>
  loadApiBaseConfig: () => Promise<{ primary: string; fallback: string } | null>
  saveApiBaseConfig: (config: { primary: string; fallback: string }) => Promise<void>
  deleteApiBaseConfig: () => Promise<void>
}

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

export {}
