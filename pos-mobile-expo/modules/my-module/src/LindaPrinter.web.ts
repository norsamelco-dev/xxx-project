import type { NativePrinter } from '../index'

export async function getPrinters(): Promise<NativePrinter[]> {
  return []
}

export async function printRawText(_printerId: string, _text: string): Promise<void> {
  throw new Error('Direct printer output is not available in the browser.')
}
