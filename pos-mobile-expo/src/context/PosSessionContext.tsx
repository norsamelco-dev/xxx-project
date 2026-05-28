import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PosConfig } from '../types/config'
import type { PosSummary, SeriesCloseRequirements } from '../types/pos'
import { closeSeries, createSeries, getSeriesCloseRequirements, getSummary, listActiveSeries } from '../services/api/posApi'
import { formatOrn } from '../utils/orsi'

type PosSessionContextValue = {
  config: PosConfig | null
  setConfig: (config: PosConfig | null) => void
  activeSeriesNo: string | null
  seriesOptions: string[]
  hasActiveSeries: boolean
  currentOrn: number
  currentOrnDisplay: string
  summary: PosSummary | null
  isBusy: boolean
  refreshSeries: () => Promise<void>
  selectSeries: (seriesNo: string) => void
  createNewSeries: () => Promise<string>
  closeSeriesByNo: (seriesNo: string) => Promise<void>
  getCloseRequirementsBySeriesNo: (seriesNo: string) => Promise<SeriesCloseRequirements>
  refreshSummary: () => Promise<void>
  setCurrentOrn: (value: number) => void
}

const PosSessionContext = createContext<PosSessionContextValue | null>(null)

const EMPTY_SUMMARY: PosSummary = {
  total_sales: 0,
  net_sales: 0,
  vat_amount: 0,
  qty_sold: 0,
  transaction_count: 0,
}

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PosConfig | null>(null)
  const [activeSeriesNo, setActiveSeriesNo] = useState<string | null>(null)
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const [currentOrn, setCurrentOrn] = useState(1)
  const [summary, setSummary] = useState<PosSummary | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const currentOrnDisplay = useMemo(() => formatOrn(currentOrn), [currentOrn])

  const hasActiveSeries = useMemo(
    () => Boolean(activeSeriesNo && seriesOptions.includes(activeSeriesNo)),
    [activeSeriesNo, seriesOptions],
  )

  const refreshSummary = useCallback(async () => {
    if (!config?.terminal_name) {
      return
    }

    if (!activeSeriesNo) {
      setSummary(EMPTY_SUMMARY)
      return
    }

    const data = await getSummary(config.terminal_name, activeSeriesNo)
    setSummary(data)
  }, [config?.terminal_name, activeSeriesNo])

  const refreshSeries = useCallback(async () => {
    if (!config?.terminal_name) {
      return
    }

    const rows = await listActiveSeries(config.terminal_name)
    const options = rows.map((row) => row.full_series_no)
    setSeriesOptions(options)

    setActiveSeriesNo((current) => {
      if (options.length === 0) {
        return null
      }

      if (current && options.includes(current)) {
        return current
      }

      return options[0]
    })
  }, [config?.terminal_name])

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

  const closeSeriesByNo = useCallback(
    async (seriesNo: string) => {
      if (!config?.terminal_name) {
        throw new Error('Terminal is not configured.')
      }

      if (!seriesNo) {
        throw new Error('No sales series selected.')
      }

      setIsBusy(true)

      try {
        await closeSeries(seriesNo, config.terminal_name)
        setActiveSeriesNo((current) => (current === seriesNo ? null : current))
        setSummary(EMPTY_SUMMARY)
        await refreshSeries()
        await refreshSummary()
      } finally {
        setIsBusy(false)
      }
    },
    [config?.terminal_name, refreshSeries, refreshSummary],
  )

  const getCloseRequirementsBySeriesNo = useCallback(
    async (seriesNo: string) => {
      if (!config?.terminal_name) {
        throw new Error('Terminal is not configured.')
      }

      if (!seriesNo) {
        throw new Error('No sales series selected.')
      }

      return getSeriesCloseRequirements(seriesNo, config.terminal_name)
    },
    [config?.terminal_name],
  )

  const value = useMemo(
    () => ({
      config,
      setConfig,
      activeSeriesNo,
      seriesOptions,
      hasActiveSeries,
      currentOrn,
      currentOrnDisplay,
      summary,
      isBusy,
      refreshSeries,
      selectSeries,
      createNewSeries,
      closeSeriesByNo,
      getCloseRequirementsBySeriesNo,
      refreshSummary,
      setCurrentOrn,
    }),
    [
      config,
      activeSeriesNo,
      seriesOptions,
      hasActiveSeries,
      currentOrn,
      currentOrnDisplay,
      summary,
      isBusy,
      refreshSeries,
      selectSeries,
      createNewSeries,
      closeSeriesByNo,
      getCloseRequirementsBySeriesNo,
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
