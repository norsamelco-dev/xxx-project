import { Platform } from 'react-native'
import RNFS from 'react-native-fs'

export function getConfigDirectory() {
  if (Platform.OS === 'windows') {
    return 'C:\\pos\\temp'
  }

  return `${RNFS.DocumentDirectoryPath}/pos`
}

export function getConfigFilePath() {
  const directory = getConfigDirectory()
  return Platform.OS === 'windows' ? `${directory}\\config.json` : `${directory}/config.json`
}
