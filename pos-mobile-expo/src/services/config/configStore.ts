import RNFS from 'react-native-fs'
import type { PosConfig } from '../../types/config'
import { getConfigDirectory, getConfigFilePath } from './configPaths'
import { normalizePosConfig } from './terminalConfig'

async function ensureConfigDirectory() {
  const directory = getConfigDirectory()
  const exists = await RNFS.exists(directory)

  if (!exists) {
    await RNFS.mkdir(directory)
  }
}

export async function configExists(): Promise<boolean> {
  return RNFS.exists(getConfigFilePath())
}

export async function loadConfig(): Promise<PosConfig | null> {
  const path = getConfigFilePath()
  const exists = await RNFS.exists(path)

  if (!exists) {
    return null
  }

  const raw = await RNFS.readFile(path, 'utf8')
  return normalizePosConfig(JSON.parse(raw) as PosConfig)
}

export async function saveConfig(config: PosConfig): Promise<void> {
  await ensureConfigDirectory()
  await RNFS.writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf8')
}

export async function deleteConfig(): Promise<void> {
  const path = getConfigFilePath()
  const exists = await RNFS.exists(path)

  if (exists) {
    await RNFS.unlink(path)
  }
}
