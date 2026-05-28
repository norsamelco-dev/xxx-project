export type NativePrinter = {
  id: string
  name: string
  connectionType: 'bluetooth' | 'usb' | 'system'
}

export { getPrinters, printRawText } from './src/LindaPrinter'
