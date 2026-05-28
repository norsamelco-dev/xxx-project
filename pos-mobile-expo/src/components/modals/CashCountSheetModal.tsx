import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { getXReport } from '../../services/api/posApi'
import { loadCashCountDraftOrEmpty, setCashCountDraft } from '../../services/cashCount/cashCountDraftStore'
import type { PosConfig } from '../../types/config'
import type { PosReport } from '../../types/pos'
import {
  type CashCountSheetPrintInput,
  type CashDenominationEntry,
  computeCashVariance,
  computePhysicalCashTotal,
  createEmptyDenominationEntries,
  formatVarianceLabel,
} from '../../types/cashCount'
import { colors, spacing } from '../../styles/theme'
import { formatMoney, parseMoneyInput, roundMoney } from '../../utils/vat'

type Props = {
  visible: boolean
  config: PosConfig
  activeSeriesNo: string | null
  cashierName: string
  isPrinting?: boolean
  onClose: () => void
  onPrint: (payload: Omit<CashCountSheetPrintInput, 'config'>) => void | Promise<void>
}

function parseQty(value: string) {
  const parsed = Number(value.replace(/\D/g, ''))
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.floor(parsed)
}

function parseCoinsOtherInput(value: string) {
  const parsed = parseMoneyInput(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return roundMoney(parsed)
}

export default function CashCountSheetModal({
  visible,
  config,
  activeSeriesNo,
  cashierName,
  isPrinting = false,
  onClose,
  onPrint,
}: Props) {
  const [report, setReport] = useState<PosReport | null>(null)
  const [denominations, setDenominations] = useState<CashDenominationEntry[]>(createEmptyDenominationEntries)
  const [coinsOther, setCoinsOther] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!visible) {
      setReport(null)
      setLoadError('')
      return
    }

    const saved = loadCashCountDraftOrEmpty(config.terminal_name, activeSeriesNo)
    setDenominations(saved.denominations)
    setCoinsOther(saved.coinsOther)

    let isMounted = true
    setIsLoading(true)
    setLoadError('')

    void getXReport(config.terminal_name)
      .then((data) => {
        if (isMounted) {
          setReport(data)
        }
      })
      .catch((error) => {
        if (isMounted) {
          setReport(null)
          setLoadError(error instanceof Error ? error.message : 'Unable to load cash breakdown.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [visible, config.terminal_name, activeSeriesNo])

  useEffect(() => {
    if (!visible || !activeSeriesNo) {
      return
    }
    setCashCountDraft(config.terminal_name, activeSeriesNo, { denominations, coinsOther })
  }, [visible, config.terminal_name, activeSeriesNo, denominations, coinsOther])

  function handleClose() {
    if (activeSeriesNo) {
      setCashCountDraft(config.terminal_name, activeSeriesNo, { denominations, coinsOther })
    }
    onClose()
  }

  const coinsOtherAmount = useMemo(() => parseCoinsOtherInput(coinsOther), [coinsOther])
  const physicalTotal = useMemo(
    () => computePhysicalCashTotal(denominations, coinsOtherAmount),
    [denominations, coinsOtherAmount],
  )
  const systemTotal = report?.cash_to_remit ?? 0
  const variance = useMemo(() => computeCashVariance(physicalTotal, systemTotal), [physicalTotal, systemTotal])
  const varianceLabel = formatVarianceLabel(variance)
  const busy = isLoading || isPrinting

  function updateDenomQty(value: number, qtyText: string) {
    const qty = parseQty(qtyText)
    setDenominations((current) =>
      current.map((row) => (row.value === value ? { ...row, qty } : row)),
    )
  }

  function handlePrintPress() {
    if (!report) {
      return
    }
    void onPrint({
      report,
      activeSeriesNo,
      cashierName,
      denominations,
      coinsOther: coinsOtherAmount,
    })
  }

  const varianceColor =
    varianceLabel === 'BALANCED' ? colors.good : varianceLabel === 'OVER' ? colors.warning : colors.bad

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 560,
            maxHeight: '90%',
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm }}>
            Cash Count Sheet
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
              {loadError ? <Text style={{ color: colors.bad, fontSize: 12, lineHeight: 18 }}>{loadError}</Text> : null}

              <View style={sectionStyle}>
                <Text style={sectionTitleStyle}>Header</Text>
                <DetailRow label="Terminal" value={config.terminal_name || '-'} />
                <DetailRow label="Sales series" value={activeSeriesNo || '-'} />
                <DetailRow label="Cashier" value={cashierName || '-'} />
                <DetailRow label="Date / time" value={new Date().toLocaleString()} />
              </View>

              {report ? (
                <View style={sectionStyle}>
                  <Text style={sectionTitleStyle}>Cash Breakdown</Text>
                  <MoneyRow label="Starting balance" value={report.starting_balance ?? 0} />
                  <MoneyRow label="Cash payment (sales)" value={report.payment_cash ?? 0} />
                  <MoneyRow label="Cash to remit (system)" value={report.cash_to_remit ?? 0} emphasized />
                  <View style={{ height: spacing.sm }} />
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: spacing.xs }}>
                    Payment breakdown (reference)
                  </Text>
                  <MoneyRow label="Cash payment" value={report.payment_cash ?? 0} />
                  <MoneyRow label="Card payment" value={report.payment_card ?? 0} />
                  <MoneyRow label="E-wallet payment" value={report.payment_ewallet ?? 0} />
                  <MoneyRow label="Total payments" value={report.total_payments ?? report.total_sales ?? 0} />
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.xs }}>
                    Reference total: {formatMoney(report.reference_total ?? 0)} (for reconciliation reference only)
                  </Text>
                </View>
              ) : null}

              <View style={sectionStyle}>
                <Text style={sectionTitleStyle}>Physical count</Text>
                <View style={tableHeaderStyle}>
                  <Text style={[tableHeaderCellStyle, { flex: 1 }]}>Denom</Text>
                  <Text style={[tableHeaderCellStyle, { width: 72, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[tableHeaderCellStyle, { width: 100, textAlign: 'right' }]}>Amount</Text>
                </View>
                {denominations.map((row) => {
                  const qty = Math.max(0, row.qty)
                  const amount = roundMoney(row.value * qty)
                  return (
                    <View key={row.value} style={tableRowStyle}>
                      <Text style={[tableCellStyle, { flex: 1 }]}>{row.value}</Text>
                      <TextInput
                        style={[qtyInputStyle, { width: 72 }]}
                        value={row.qty > 0 ? String(row.qty) : ''}
                        onChangeText={(text) => updateDenomQty(row.value, text)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        editable={!busy}
                      />
                      <Text style={[tableCellStyle, { width: 100, textAlign: 'right' }]}>{formatMoney(amount)}</Text>
                    </View>
                  )
                })}
                <View style={tableRowStyle}>
                  <Text style={[tableCellStyle, { flex: 1 }]}>Coins / Other</Text>
                  <View style={{ width: 72 }} />
                  <TextInput
                    style={[qtyInputStyle, { width: 100, textAlign: 'right' }]}
                    value={coinsOther}
                    onChangeText={setCoinsOther}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    editable={!busy}
                  />
                </View>
              </View>

              <View style={sectionStyle}>
                <MoneyRow label="Physical count total" value={physicalTotal} emphasized />
                <MoneyRow label="System cash total" value={systemTotal} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Variance ({varianceLabel})</Text>
                  <Text style={{ color: varianceColor, fontWeight: '800', fontSize: 14 }}>{formatMoney(variance)}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.xs }}>
                  Compare physical total to Cash to remit above.
                </Text>
              </View>
            </ScrollView>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              style={[secondaryButtonStyle, { flex: 1 }, busy && { opacity: 0.5 }]}
              onPress={handleClose}
              disabled={busy}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Pressable
              style={[primaryButtonStyle, { flex: 1 }, (busy || !report || Boolean(loadError)) && { opacity: 0.5 }]}
              onPress={handlePrintPress}
              disabled={busy || !report || Boolean(loadError)}
            >
              <Text style={{ color: '#052e16', fontWeight: '800' }}>{isPrinting ? 'Printing…' : 'Print'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const sectionStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
  gap: spacing.xs,
}

const sectionTitleStyle = {
  color: colors.text,
  fontSize: 13,
  fontWeight: '700' as const,
  marginBottom: spacing.xs,
}

const tableHeaderStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingBottom: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
}

const tableRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.sm,
  paddingVertical: 4,
}

const tableHeaderCellStyle = {
  color: colors.textMuted,
  fontSize: 11,
  fontWeight: '700' as const,
}

const tableCellStyle = {
  color: colors.text,
  fontSize: 13,
  fontWeight: '600' as const,
}

const qtyInputStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  paddingHorizontal: spacing.sm,
  paddingVertical: 6,
  color: colors.text,
  fontSize: 13,
  textAlign: 'center' as const,
}

const primaryButtonStyle = {
  backgroundColor: colors.good,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
}

const secondaryButtonStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
  borderWidth: 1,
  borderColor: colors.border,
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

function MoneyRow({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: emphasized ? '700' : '400' }}>{label}</Text>
      <Text
        style={{
          color: emphasized ? colors.accent : colors.text,
          fontWeight: emphasized ? '800' : '600',
          fontSize: emphasized ? 14 : 12,
        }}
      >
        {formatMoney(value)}
      </Text>
    </View>
  )
}
