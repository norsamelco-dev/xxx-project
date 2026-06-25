import type { NavigationProp } from '@react-navigation/native'
import { clearCashCountDraft } from '../cashCount/cashCountDraftStore'
import { deleteConfig } from './configStore'
import { confirmAsync } from '../../utils/confirm'
import type { RootStackParamList } from '../../navigation/types'

type ReregisterOptions = {
  navigation: NavigationProp<RootStackParamList>
  logout: () => Promise<void>
  onConfigCleared?: () => void
}

export async function performTerminalReregister({ navigation, logout, onConfigCleared }: ReregisterOptions) {
  await deleteConfig()
  clearCashCountDraft()
  navigation.reset({ index: 0, routes: [{ name: 'MachineRegistration' }] })
  onConfigCleared?.()
  await logout()
}

export async function reregisterTerminal(options: ReregisterOptions) {
  const confirmed = await confirmAsync(
    'Re-register terminal',
    'This deletes local config and restarts setup. Continue?',
    'Continue',
    'Cancel',
  )

  if (!confirmed) {
    return
  }

  await performTerminalReregister(options)
}
