import axios from 'axios'
import type { PrinterDevice } from './printerService'
import { reportGlobalConnectionError } from '../../context/NetworkErrorContext'

function getLocalApiBaseUrl(): string {
  const local =
    process.env.EXPO_PUBLIC_POS_API_URL_LOCAL ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:5000'
      : '')

  return local.replace(/\/+$/, '')
}

export async function discoverPrinters(): Promise<PrinterDevice[]> {
  const baseUrl = getLocalApiBaseUrl()

  if (!baseUrl) {
    return []
  }

  try {
    const response = await axios.get<{ data: PrinterDevice[] }>(`${baseUrl}/api/local/printers`, {
      timeout: 10000,
    })

    return (response.data.data || []).map((printer) => ({
      id: printer.id,
      name: printer.name,
      connectionType: printer.connectionType || 'system',
    }))
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && !error.response) {
      reportGlobalConnectionError({
        source: 'printer-discovery',
        url: `${baseUrl}/api/local/printers`,
        message: error.message,
      })
    }
    return []
  }
}
