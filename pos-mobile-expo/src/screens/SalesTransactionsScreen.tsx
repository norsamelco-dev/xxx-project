import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import SalesTransactionsGrid, { gridTheme } from '../components/pos/SalesTransactionsGrid'
import type { TransactionStatus } from '../components/pos/SalesTransactionsGrid'
import TransactionDetailModal from '../components/modals/TransactionDetailModal'
import VoidReasonModal from '../components/modals/VoidReasonModal'
import { useAuth } from '../context/AuthContext'
import { usePosSession } from '../context/PosSessionContext'
import { useToast } from '../context/ToastContext'
import {
  getPosTransactionReceipt,
  getReceiptHeadingPublic,
  listPosSalesSeries,
  listPosSalesTransactionItems,
  listPosSalesTransactions,
  voidPosTransaction,
  voidPosTransactionItem,
} from '../services/api/posApi'
import { printSalesReceipt } from '../services/printer/printerService'
import type { SalesItemRow, SalesSeriesRow, SalesTransactionRow } from '../types/sales'
import type { RootStackParamList } from '../navigation/types'
import { fonts, spacing } from '../styles/theme'
import { mapCheckoutLinesToCartLines, mapCheckoutTotalsToCartTotals } from '../utils/checkoutReceipt'
import { formatMoney } from '../utils/vat'

type Props = NativeStackScreenProps<RootStackParamList, 'SalesTransactions'>

type PendingVoid = { orsi: number; seriesNo: string }

type SeriesOption = { value: string; label: string }

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isVoided(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'Y' || normalized === 'YES' || normalized === '1'
}

function isSeriesOpen(series: SalesSeriesRow | undefined) {
  return String(series?.lockbatch || '').trim().toUpperCase() !== 'Y'
}

function pickDefaultSeriesNo(rows: SalesSeriesRow[], preferred?: string | null) {
  const options = rows.map((row) => row.full_series_no || '').filter(Boolean)

  if (!options.length) {
    return null
  }

  if (preferred && options.includes(preferred)) {
    return preferred
  }

  return options[0]
}

function getTransactionStatus(transaction: SalesTransactionRow, items: SalesItemRow[]): TransactionStatus {
  if (isVoided(transaction.VOIDED)) {
    return 'VOIDED'
  }

  if (!items.length) {
    return 'ACTIVE'
  }

  const voidedCount = items.filter((item) => isVoided(item.VOIDED)).length
  if (voidedCount === 0) {
    return 'ACTIVE'
  }

  if (voidedCount >= items.length) {
    return 'VOIDED'
  }

  return 'PARTIAL'
}

export default function SalesTransactionsScreen({ route }: Props) {
  const { config } = usePosSession()
  const { user } = useAuth()
  const { showToast } = useToast()
  const initialSeriesNo = route.params?.seriesNo

  const [seriesRows, setSeriesRows] = useState<SalesSeriesRow[]>([])
  const [filterSeriesNo, setFilterSeriesNo] = useState<string | null>(null)
  const [seriesPickerOpen, setSeriesPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [transactions, setTransactions] = useState<SalesTransactionRow[]>([])
  const [expandedOrsis, setExpandedOrsis] = useState<number[]>([])
  const [itemsByOrsi, setItemsByOrsi] = useState<Record<number, SalesItemRow[]>>({})
  const [loadingSeries, setLoadingSeries] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({})
  const [busyOrsi, setBusyOrsi] = useState<number | null>(null)
  const [pendingVoid, setPendingVoid] = useState<PendingVoid | null>(null)
  const [isVoidSubmitting, setIsVoidSubmitting] = useState(false)
  const [openOrsi, setOpenOrsi] = useState<number | null>(null)
  const [loadingOpenOrsi, setLoadingOpenOrsi] = useState(false)
  const [voidCompletion, setVoidCompletion] = useState<{
    orsi: number
    refundAmount: number
  } | null>(null)

  const activeSeriesNo = filterSeriesNo
  const activeSeries = useMemo(
    () => seriesRows.find((row) => row.full_series_no === activeSeriesNo),
    [activeSeriesNo, seriesRows],
  )
  const seriesOpen = isSeriesOpen(activeSeries)

  const openTransaction = useMemo(
    () => (openOrsi == null ? null : transactions.find((row) => row.ORSI === openOrsi) || null),
    [openOrsi, transactions],
  )

  const openTransactionItems = openOrsi != null ? itemsByOrsi[openOrsi] || [] : []

  const seriesOptions = useMemo(
    () =>
      seriesRows
        .map((row) => {
          const seriesNo = row.full_series_no || ''
          if (!seriesNo) {
            return null
          }

          const closed = !isSeriesOpen(row)
          return {
            value: seriesNo,
            label: closed ? `${seriesNo} (closed)` : seriesNo,
          }
        })
        .filter((option): option is SeriesOption => Boolean(option)),
    [seriesRows],
  )

  const loadSeries = useCallback(async () => {
    if (!config?.terminal_name) {
      setError('Terminal is not configured.')
      setSeriesRows([])
      return []
    }

    setError(null)
    const data = await listPosSalesSeries(config.terminal_name)
    setSeriesRows(data)
    return data
  }, [config?.terminal_name])

  const loadTransactions = useCallback(
    async (seriesNo: string) => {
      if (!config?.terminal_name || !seriesNo) {
        setTransactions([])
        return
      }

      setLoadingTransactions(true)
      try {
        const data = await listPosSalesTransactions(config.terminal_name, seriesNo)
        setTransactions(data)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load transactions.')
        setTransactions([])
      } finally {
        setLoadingTransactions(false)
      }
    },
    [config?.terminal_name],
  )

  const loadItems = useCallback(
    async (orsi: number, force = false) => {
      if (!config?.terminal_name || !orsi) {
        return
      }

      if (!force) {
        let alreadyLoaded = false
        setItemsByOrsi((current) => {
          alreadyLoaded = Boolean(current[orsi])
          return current
        })
        if (alreadyLoaded) {
          return
        }
      }

      setLoadingItems((current) => ({ ...current, [orsi]: true }))
      try {
        const data = await listPosSalesTransactionItems(config.terminal_name, orsi)
        setItemsByOrsi((current) => ({ ...current, [orsi]: data }))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load line items.')
      } finally {
        setLoadingItems((current) => ({ ...current, [orsi]: false }))
      }
    },
    [config?.terminal_name],
  )

  useEffect(() => {
    void (async () => {
      setLoadingSeries(true)
      try {
        const data = await loadSeries()
        setFilterSeriesNo(pickDefaultSeriesNo(data || [], initialSeriesNo))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load sales series.')
      } finally {
        setLoadingSeries(false)
      }
    })()
  }, [initialSeriesNo, loadSeries])

  useEffect(() => {
    if (!activeSeriesNo) {
      setTransactions([])
      return
    }

    setSearchQuery('')
    void loadTransactions(activeSeriesNo)
  }, [activeSeriesNo, loadTransactions])

  async function handleRefresh() {
    setRefreshing(true)
    setItemsByOrsi({})
    setExpandedOrsis([])

    try {
      const data = await loadSeries()
      const nextSeries =
        activeSeriesNo && data?.some((row) => row.full_series_no === activeSeriesNo)
          ? activeSeriesNo
          : pickDefaultSeriesNo(data || [], initialSeriesNo)

      if (nextSeries !== activeSeriesNo) {
        setFilterSeriesNo(nextSeries)
      }

      if (nextSeries) {
        await loadTransactions(nextSeries)
      } else {
        setTransactions([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh.')
    } finally {
      setRefreshing(false)
    }
  }

  function toggleTransaction(orsi: number) {
    const isExpanded = expandedOrsis.includes(orsi)

    if (isExpanded) {
      setExpandedOrsis((current) => current.filter((value) => value !== orsi))
      return
    }

    setExpandedOrsis((current) => [...current, orsi])
    void loadItems(orsi)
  }

  function applyVoidResult(orsi: number, items: SalesItemRow[], transaction: SalesTransactionRow) {
    setItemsByOrsi((current) => ({ ...current, [orsi]: items }))
    setTransactions((current) => current.map((row) => (row.ORSI === orsi ? transaction : row)))
  }

  async function handleConfirmVoid(reason: string) {
    if (!pendingVoid || !config?.terminal_name) {
      return
    }

    setIsVoidSubmitting(true)

    try {
      const result = await voidPosTransaction(config.terminal_name, pendingVoid.orsi, reason)
      applyVoidResult(pendingVoid.orsi, result.items, result.transaction)
      showToast(`OR/SI ${String(pendingVoid.orsi).padStart(8, '0')} cancelled.`, 'info')

      if (activeSeriesNo) {
        await loadSeries()
      }

      setPendingVoid(null)
    } catch (voidError) {
      const message = voidError instanceof Error ? voidError.message : 'Void request failed.'
      showToast(message, 'error')
    } finally {
      setIsVoidSubmitting(false)
    }
  }

  async function handleOpen(orsi: number) {
    setOpenOrsi(orsi)

    if (itemsByOrsi[orsi]) {
      return
    }

    setLoadingOpenOrsi(true)
    try {
      await loadItems(orsi, true)
    } finally {
      setLoadingOpenOrsi(false)
    }
  }

  async function handleReprint(orsi: number) {
    if (!config?.terminal_name) {
      return
    }

    if (!config.default_printer) {
      showToast('Set a default printer in File → Default Printer.', 'error')
      return
    }

    setBusyOrsi(orsi)

    try {
      const receipt = await getPosTransactionReceipt(config.terminal_name, orsi)
      const heading = await getReceiptHeadingPublic()
      const cashierName = user?.fullName || user?.username || 'Cashier'
      const lines = mapCheckoutLinesToCartLines(receipt.checkout.lines)
      const totals = mapCheckoutTotalsToCartTotals(receipt.checkout.totals)

      await printSalesReceipt(
        {
          heading,
          config,
          cashierName,
          cashierId: user?.userId,
          seriesNo: receipt.sales_series_no || activeSeriesNo || '',
          orsiDisplay: receipt.checkout.orsi_display,
          lines,
          totals,
          checkout: receipt.checkout,
          paymentRefNo: receipt.checkout.payment_ref_no,
          transactionDate: new Date(),
        },
        config.default_printer,
        config.default_printer_id,
        config.default_printer_connection,
      )

      showToast(`Reprint sent for OR/SI ${String(orsi).padStart(8, '0')}.`, 'info')
    } catch (printError) {
      const message = printError instanceof Error ? printError.message : 'Reprint failed.'
      showToast(message, 'error')
    } finally {
      setBusyOrsi(null)
    }
  }

  async function handleModalSaveAndReprint(payload: {
    voidEntire: boolean
    itemIdsToVoid: number[]
    voidReason: string
  }) {
    if (!config?.terminal_name || openOrsi == null) {
      return
    }

    const orsi = openOrsi
    const hasVoids = payload.voidEntire || payload.itemIdsToVoid.length > 0
    let afterTransaction: SalesTransactionRow | null = null
    const itemsSnapshot = itemsByOrsi[orsi] || openTransactionItems
    const refundAmount = payload.voidEntire
      ? itemsSnapshot
          .filter((item) => !isVoided(item.VOIDED))
          .reduce((sum, item) => sum + toNumber(item.TOTAL), 0)
      : payload.itemIdsToVoid.reduce((sum, itemId) => {
          const item = itemsSnapshot.find((row) => row.ID === itemId)
          if (!item || isVoided(item.VOIDED)) {
            return sum
          }
          return sum + toNumber(item.TOTAL)
        }, 0)
    setIsVoidSubmitting(true)

    try {
      if (payload.voidEntire) {
        const result = await voidPosTransaction(config.terminal_name, orsi, payload.voidReason)
        applyVoidResult(orsi, result.items, result.transaction)
        afterTransaction = result.transaction
        showToast(`OR/SI ${String(orsi).padStart(8, '0')} cancelled.`, 'info')
      } else if (payload.itemIdsToVoid.length > 0) {
        const currentItems = itemsByOrsi[orsi] || []
        const idsToVoid = payload.itemIdsToVoid.filter((itemId) => {
          const item = currentItems.find((row) => row.ID === itemId)
          return item && !isVoided(item.VOIDED)
        })

        let latest = {
          transaction: transactions.find((row) => row.ORSI === orsi)!,
          items: currentItems,
        }

        for (const itemId of idsToVoid) {
          const result = await voidPosTransactionItem(
            config.terminal_name,
            orsi,
            itemId,
            payload.voidReason,
          )
          latest = result
        }

        applyVoidResult(orsi, latest.items, latest.transaction)
        afterTransaction = latest.transaction
        showToast(
          idsToVoid.length === 1 ? 'Line item voided.' : `${idsToVoid.length} line items voided.`,
          'info',
        )
      }

      if (activeSeriesNo) {
        await loadSeries()
      }

      if (!hasVoids) {
        await handleReprint(orsi)
      } else if (!afterTransaction || !isVoided(afterTransaction.VOIDED)) {
        // Reprint only when OR/SI is not fully voided.
        await handleReprint(orsi)
      } else {
        showToast(`OR/SI ${String(orsi).padStart(8, '0')} fully voided. Reprint skipped.`, 'info')
      }

      setOpenOrsi(null)

      if (hasVoids) {
        setVoidCompletion({ orsi, refundAmount: Math.max(0, refundAmount) })
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save changes.'
      showToast(message, 'error')
    } finally {
      setIsVoidSubmitting(false)
    }
  }

  const voidModalCopy = pendingVoid
    ? {
        title: 'Cancel entire OR/SI?',
        message: `This will void OR/SI ${String(pendingVoid.orsi).padStart(8, '0')} and restore stock for all line items.`,
        confirmLabel: 'Cancel OR/SI',
      }
    : null

  return (
    <View style={{ flex: 1, backgroundColor: gridTheme.pageBg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={gridTheme.accent}
          />
        }
      >
        <Text style={{ color: gridTheme.text, fontFamily: fonts.extrabold, fontSize: 20, marginBottom: spacing.xs }}>
          Sales transactions
        </Text>
        <Text style={{ color: gridTheme.textMuted, fontSize: 12, marginBottom: spacing.md, lineHeight: 18 }}>
          Terminal: {config?.terminal_name || '-'} · Expand a row for line items; use Open to void and reprint.
        </Text>

        {error ? (
          <View style={panelStyle}>
            <Text style={{ color: gridTheme.bad, lineHeight: 20 }}>{error}</Text>
          </View>
        ) : null}

        <View style={panelStyle}>
          <Text style={sectionTitleStyle}>Sales series</Text>
          <SeriesCombobox
            options={seriesOptions}
            value={filterSeriesNo}
            seriesOpen={seriesOpen}
            disabled={loadingSeries || seriesOptions.length === 0}
            pickerOpen={seriesPickerOpen}
            onOpenPicker={() => setSeriesPickerOpen(true)}
            onClosePicker={() => setSeriesPickerOpen(false)}
            onChange={setFilterSeriesNo}
          />

          {activeSeries ? (
            <View style={[summaryRowStyle, { marginTop: spacing.md, marginBottom: 0 }]}>
              <SummaryCard label="Total sales" value={formatMoney(toNumber(activeSeries.totalsales))} />
              <SummaryCard label="VAT" value={formatMoney(toNumber(activeSeries.vat_amount))} />
              <SummaryCard label="Grand total" value={formatMoney(toNumber(activeSeries.grand_total))} />
              <SummaryCard label="Transactions" value={String(toNumber(activeSeries.transaction_count))} />
            </View>
          ) : null}
        </View>

        {loadingSeries ? (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <ActivityIndicator color={gridTheme.accent} />
            <Text style={{ color: gridTheme.textMuted, marginTop: spacing.sm }}>Loading series...</Text>
          </View>
        ) : seriesOptions.length === 0 ? (
          <View style={panelStyle}>
            <Text style={{ color: gridTheme.textMuted }}>No sales series found for this terminal and cashier.</Text>
          </View>
        ) : !activeSeriesNo ? (
          <View style={panelStyle}>
            <Text style={{ color: gridTheme.textMuted }}>Choose a sales series to view transactions.</Text>
          </View>
        ) : loadingTransactions ? (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <ActivityIndicator color={gridTheme.accent} />
            <Text style={{ color: gridTheme.textMuted, marginTop: spacing.sm }}>Loading transactions...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={panelStyle}>
            <Text style={{ color: gridTheme.textMuted }}>No transactions in this series.</Text>
          </View>
        ) : (
          <SalesTransactionsGrid
            transactions={transactions}
            expandedOrsis={expandedOrsis}
            itemsByOrsi={itemsByOrsi}
            loadingItems={loadingItems}
            seriesOpen={seriesOpen}
            busyOrsi={busyOrsi}
            isVoidSubmitting={isVoidSubmitting}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            getStatus={getTransactionStatus}
            onToggleExpand={toggleTransaction}
            onOpen={(orsi) => void handleOpen(orsi)}
            onCancelOrsi={(orsi) => {
              if (activeSeriesNo) {
                setPendingVoid({ orsi, seriesNo: activeSeriesNo })
              }
            }}
            onReprint={(orsi) => void handleReprint(orsi)}
          />
        )}
      </ScrollView>

      <TransactionDetailModal
        visible={openOrsi != null}
        transaction={openTransaction}
        items={openTransactionItems}
        loadingItems={Boolean(openOrsi != null && (loadingOpenOrsi || loadingItems[openOrsi]))}
        seriesOpen={seriesOpen}
        isSubmitting={isVoidSubmitting || busyOrsi != null}
        onClose={() => {
          if (!isVoidSubmitting && busyOrsi == null) {
            setOpenOrsi(null)
          }
        }}
        onSaveAndReprint={handleModalSaveAndReprint}
      />

      <Modal
        visible={Boolean(voidCompletion)}
        transparent
        animationType="fade"
        onRequestClose={() => setVoidCompletion(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: gridTheme.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: gridTheme.border,
              padding: spacing.lg,
              width: '100%',
              maxWidth: 520,
              alignSelf: 'center',
            }}
          >
            <Text style={{ color: gridTheme.text, fontFamily: fonts.extrabold, fontSize: 18, marginBottom: spacing.xs }}>
              Void saved
            </Text>
            <Text style={{ color: gridTheme.textMuted, fontSize: 12, lineHeight: 18 }}>
              OR/SI {voidCompletion ? String(voidCompletion.orsi).padStart(8, '0') : '-'}
            </Text>

            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: 10,
                backgroundColor: gridTheme.surfaceAlt,
              }}
            >
              <Text style={{ color: gridTheme.textMuted, fontSize: 11, fontFamily: fonts.bold, textTransform: 'uppercase' }}>
                Amount to be refunded
              </Text>
              <Text style={{ color: gridTheme.good, fontFamily: fonts.black, fontSize: 22, marginTop: 4 }}>
                {formatMoney(voidCompletion?.refundAmount || 0)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setVoidCompletion(null)}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: gridTheme.border,
                  backgroundColor: gridTheme.surface,
                }}
              >
                <Text style={{ color: gridTheme.text, fontFamily: fonts.bold }}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <VoidReasonModal
        visible={Boolean(pendingVoid)}
        title={voidModalCopy?.title || ''}
        message={voidModalCopy?.message || ''}
        confirmLabel={voidModalCopy?.confirmLabel}
        isSubmitting={isVoidSubmitting}
        onCancel={() => {
          if (!isVoidSubmitting) {
            setPendingVoid(null)
          }
        }}
        onConfirm={(reason) => void handleConfirmVoid(reason)}
      />
    </View>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryCardStyle}>
      <Text style={{ color: gridTheme.textMuted, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: gridTheme.text, fontFamily: fonts.extrabold, fontSize: 16 }}>{value}</Text>
    </View>
  )
}

function SeriesCombobox({
  options,
  value,
  seriesOpen,
  disabled,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onChange,
}: {
  options: SeriesOption[]
  value: string | null
  seriesOpen: boolean
  disabled?: boolean
  pickerOpen: boolean
  onOpenPicker: () => void
  onClosePicker: () => void
  onChange: (seriesNo: string) => void
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || 'Select sales series'
  const statusBorderColor = seriesOpen ? gridTheme.good : gridTheme.warning

  if (Platform.OS === 'web') {
    return (
      <View style={{ marginTop: spacing.sm }}>
        <select
          value={value || ''}
          disabled={disabled}
          onChange={(event: { target: { value: string } }) => {
            if (event.target.value) {
              onChange(event.target.value)
            }
          }}
          style={{
            width: '100%',
            backgroundColor: gridTheme.surface,
            color: gridTheme.text,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: statusBorderColor,
            borderRadius: 8,
            padding: `${spacing.sm}px ${spacing.md}px`,
            fontSize: 14,
            fontFamily: fonts.semibold,
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </View>
    )
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      <Pressable
        style={[comboboxTriggerStyle, { borderColor: statusBorderColor }, disabled && { opacity: 0.45 }]}
        onPress={onOpenPicker}
        disabled={disabled}
      >
        <Text style={{ color: gridTheme.text, fontFamily: fonts.semibold, flex: 1 }} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={{ color: gridTheme.textMuted, fontFamily: fonts.bold }}>▼</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={onClosePicker}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg }}
          onPress={onClosePicker}
        >
          <View
            style={{
              backgroundColor: gridTheme.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: gridTheme.border,
              padding: spacing.lg,
              maxHeight: '70%',
            }}
          >
            <Text style={{ color: gridTheme.text, fontFamily: fonts.extrabold, marginBottom: spacing.sm }}>Sales series</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const selected = value === option.value

                return (
                  <Pressable
                    key={option.value}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: 8,
                      marginBottom: spacing.xs,
                      backgroundColor: selected ? gridTheme.accent : gridTheme.surfaceAlt,
                    }}
                    onPress={() => {
                      onChange(option.value)
                      onClosePicker()
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#0f172a' : gridTheme.text,
                        fontFamily: fonts.bold,
                      }}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const panelStyle = {
  backgroundColor: gridTheme.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: gridTheme.border,
  padding: spacing.md,
  marginBottom: spacing.md,
}

const sectionTitleStyle = {
  color: gridTheme.text,
  fontFamily: fonts.bold,
  fontSize: 14,
}

const metaTextStyle = {
  color: gridTheme.textMuted,
  fontSize: 12,
  marginTop: 2,
  lineHeight: 18,
}

const summaryRowStyle = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  gap: spacing.sm,
  marginBottom: spacing.md,
}

const summaryCardStyle = {
  backgroundColor: gridTheme.surfaceAlt,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: gridTheme.border,
  padding: spacing.sm,
  paddingHorizontal: spacing.md,
  minWidth: 120,
  flexGrow: 1,
}

const comboboxTriggerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  width: '100%' as const,
  gap: spacing.sm,
  backgroundColor: gridTheme.surfaceAlt,
  borderWidth: 1,
  borderColor: gridTheme.border,
  borderRadius: 8,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
}
