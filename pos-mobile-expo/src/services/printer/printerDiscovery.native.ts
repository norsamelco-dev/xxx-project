import { PermissionsAndroid, Platform } from 'react-native'
import type { PrinterDevice } from './printerService'

async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return true
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ]

  const results = await PermissionsAndroid.requestMultiple(permissions)
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
  )
}

export async function discoverPrinters(): Promise<PrinterDevice[]> {
  const granted = await ensureBluetoothPermissions()

  if (!granted) {
    throw new Error('Bluetooth permission is required to list paired printers.')
  }

  const { getPrinters } = await import('linda-printer')
  const devices = await getPrinters()

  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    connectionType: device.connectionType,
  }))
}
