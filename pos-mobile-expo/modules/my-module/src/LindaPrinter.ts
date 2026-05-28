import { requireOptionalNativeModule } from 'expo-modules-core'
import type { NativePrinter } from '../index'

type LindaPrinterModule = {
  getPrinters(): Promise<NativePrinter[]>
  printRawText(printerId: string, text: string): Promise<void>
}

const LindaPrinterNative = requireOptionalNativeModule<LindaPrinterModule>('LindaPrinter')

function getNativeModule(): LindaPrinterModule {
  if (!LindaPrinterNative) {
    throw new Error(
      'Printer native module is missing. Rebuild the Android app after installing linda-printer: npx expo prebuild --platform android && npx expo run:android',
    )
  }

  return LindaPrinterNative
}

export async function getPrinters(): Promise<NativePrinter[]> {
  return getNativeModule().getPrinters()
}

export async function printRawText(printerId: string, text: string): Promise<void> {
  return getNativeModule().printRawText(printerId, text)
}
