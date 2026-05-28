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

export async function reregisterTerminal({ navigation, logout, onConfigCleared }: ReregisterOptions) {
  const confirmed = await confirmAsync(
    'Re-register terminal',
    'This deletes local config and restarts setup. Continue?',
    'Continue',
    'Cancel',
  )

  if (!confirmed) {
    return
  }

  await deleteConfig()
  clearCashCountDraft()
  onConfigCleared?.()
  await logout()
  navigation.reset({ index: 0, routes: [{ name: 'MachineRegistration' }] })
}
