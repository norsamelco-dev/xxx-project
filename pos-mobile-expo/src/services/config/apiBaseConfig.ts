import RNFS from 'react-native-fs'
import { getConfigDirectory } from './configPaths'

const API_BASE_CONFIG_PATH = `${getConfigDirectory()}/api-base-config.json`

export type ApiBaseConfig = {
  primary: string
  fallback: string
}

async function ensureConfigDirectory() {
  const directory = getConfigDirectory()
  const exists = await RNFS.exists(directory)

  if (!exists) {
    await RNFS.mkdir(directory)
  }
}

export async function loadApiBaseConfig(): Promise<ApiBaseConfig | null> {
  const exists = await RNFS.exists(API_BASE_CONFIG_PATH)
  if (!exists) {
    return null
  }

  const raw = await RNFS.readFile(API_BASE_CONFIG_PATH, 'utf8')
  return JSON.parse(raw) as ApiBaseConfig
}

export async function saveApiBaseConfig(config: ApiBaseConfig): Promise<void> {
  await ensureConfigDirectory()
  await RNFS.writeFile(API_BASE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

export async function clearApiBaseConfig(): Promise<void> {
  const exists = await RNFS.exists(API_BASE_CONFIG_PATH)
  if (exists) {
    await RNFS.unlink(API_BASE_CONFIG_PATH)
  }
}
