import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type NetworkErrorDetails = {
  source?: string
  url?: string
  message?: string
  at: number
}

type NetworkErrorContextValue = {
  hasConnectionError: boolean
  details: NetworkErrorDetails | null
  reportConnectionError: (details?: Omit<NetworkErrorDetails, 'at'>) => void
  clearConnectionError: () => void
}

const NetworkErrorContext = createContext<NetworkErrorContextValue | null>(null)

let externalReporter: ((details?: Omit<NetworkErrorDetails, 'at'>) => void) | null = null
let externalClearer: (() => void) | null = null

export function reportGlobalConnectionError(details?: Omit<NetworkErrorDetails, 'at'>) {
  externalReporter?.(details)
}

export function clearGlobalConnectionError() {
  externalClearer?.()
}

export function NetworkErrorProvider({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState<NetworkErrorDetails | null>(null)

  const reportConnectionError = useCallback((incoming?: Omit<NetworkErrorDetails, 'at'>) => {
    setDetails({
      source: incoming?.source,
      url: incoming?.url,
      message: incoming?.message,
      at: Date.now(),
    })
  }, [])

  const clearConnectionError = useCallback(() => {
    setDetails(null)
  }, [])

  useEffect(() => {
    externalReporter = reportConnectionError
    externalClearer = clearConnectionError
    return () => {
      externalReporter = null
      externalClearer = null
    }
  }, [reportConnectionError, clearConnectionError])

  const value = useMemo(
    () => ({
      hasConnectionError: details !== null,
      details,
      reportConnectionError,
      clearConnectionError,
    }),
    [details, reportConnectionError, clearConnectionError],
  )

  return <NetworkErrorContext.Provider value={value}>{children}</NetworkErrorContext.Provider>
}

export function useNetworkError() {
  const context = useContext(NetworkErrorContext)

  if (!context) {
    throw new Error('useNetworkError must be used within NetworkErrorProvider')
  }

  return context
}
