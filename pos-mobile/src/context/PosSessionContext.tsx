import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PosConfig } from '../types/config'
import type { PosSummary } from '../types/pos'
import { createSeries, getSummary, listActiveSeries } from '../services/api/posApi'
import { formatOrn } from '../utils/orsi'

type PosSessionContextValue = {
  config: PosConfig | null
  setConfig: (config: PosConfig | null) => void
  activeSeriesNo: string | null
  seriesOptions: string[]
  currentOrn: number
  currentOrnDisplay: string
  summary: PosSummary | null
  isBusy: boolean
  refreshSeries: () => Promise<void>
  selectSeries: (seriesNo: string) => void
  createNewSeries: () => Promise<string>
  refreshSummary: () => Promise<void>
  setCurrentOrn: (value: number) => void
}

const PosSessionContext = createContext<PosSessionContextValue | null>(null)

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PosConfig | null>(null)
  const [activeSeriesNo, setActiveSeriesNo] = useState<string | null>(null)
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const [currentOrn, setCurrentOrn] = useState(1)
  const [summary, setSummary] = useState<PosSummary | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const currentOrnDisplay = useMemo(() => formatOrn(currentOrn), [currentOrn])

  const refreshSummary = useCallback(async () => {
    if (!config?.terminal_name) {
      return
    }

    const data = await getSummary(config.terminal_name, activeSeriesNo || undefined)
    setSummary(data)
  }, [config?.terminal_name, activeSeriesNo])

  const refreshSeries = useCallback(async () => {
    if (!config?.terminal_name) {
      return
    }

    const rows = await listActiveSeries(config.terminal_name)
    const options = rows.map((row) => row.full_series_no)
    setSeriesOptions(options)

    if (!activeSeriesNo && options.length > 0) {
      setActiveSeriesNo(options[0])
    }
  }, [config?.terminal_name, activeSeriesNo])

  const selectSeries = useCallback((seriesNo: string) => {
    setActiveSeriesNo(seriesNo)
  }, [])

  const createNewSeries = useCallback(async () => {
    if (!config?.terminal_name) {
      throw new Error('Terminal is not configured.')
    }

    setIsBusy(true)

    try {
      const created = await createSeries(config.terminal_name)
      setActiveSeriesNo(created.full_series_no)
      setCurrentOrn(created.next_orsi)
      await refreshSeries()
      return created.full_series_no
    } finally {
      setIsBusy(false)
    }
  }, [config?.terminal_name, refreshSeries])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      activeSeriesNo,
      seriesOptions,
      currentOrn,
      currentOrnDisplay,
      summary,
      isBusy,
      refreshSeries,
      selectSeries,
      createNewSeries,
      refreshSummary,
      setCurrentOrn,
    }),
    [
      config,
      activeSeriesNo,
      seriesOptions,
      currentOrn,
      currentOrnDisplay,
      summary,
      isBusy,
      refreshSeries,
      selectSeries,
      createNewSeries,
      refreshSummary,
    ],
  )

  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>
}

export function usePosSession() {
  const context = useContext(PosSessionContext)

  if (!context) {
    throw new Error('usePosSession must be used within PosSessionProvider')
  }

  return context
}
