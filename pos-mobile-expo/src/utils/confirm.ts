import { Alert, Platform } from 'react-native'

export function confirmAsync(title: string, message: string, confirmLabel = 'OK', cancelLabel = 'Cancel'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export function alertMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
    return
  }

  Alert.alert(title, message)
}
