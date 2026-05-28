import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInput as TextInputType } from 'react-native'
import { isCheckoutShortcut, isCustomQtyShortcut } from '../../hooks/useDesktopKeyboardShortcuts'
import type { CartTotals } from '../../types/cart'
import type { PosSummary } from '../../types/pos'
import { colors, fonts, spacing } from '../../styles/theme'
import { formatInteger, formatMoney, formatPercent } from '../../utils/vat'

const BARCODE_INPUT_REFOCUS_MS = 1000

const panelWidth = Platform.OS === 'web'
  ? ({ width: '28%', minWidth: 240, maxWidth: 320 } as const)
  : { width: 260 }

type Props = {
  currentOrnDisplay: string
  terminalName: string
  barcode: string
  qty: number
  totals: CartTotals
  summary: PosSummary | null
  cashierName: string
  disabled?: boolean
  refocusEnabled?: boolean
  onBarcodeChange: (value: string) => void
  onQtyChange: (value: number) => void
  onScanSubmit: () => void
  onCheckout: () => void
  onCustomQty: () => void
  onDiscount: () => void
  onSearch: () => void
}

export default function RightSummaryPanel({
  currentOrnDisplay,
  terminalName,
  barcode,
  qty,
  totals,
  summary,
  cashierName,
  disabled = false,
  refocusEnabled = true,
  onBarcodeChange,
  onQtyChange,
  onScanSubmit,
  onCheckout,
  onCustomQty,
  onDiscount,
  onSearch,
}: Props) {
  const initials = getInitials(cashierName)
  const barcodeInputRef = useRef<TextInputType>(null)
  const [isBarcodeFocused, setIsBarcodeFocused] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (disabled || !refocusEnabled) {
      return
    }
    const focusTimer = setTimeout(() => {
      barcodeInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(focusTimer)
  }, [disabled, refocusEnabled])

  useEffect(() => {
    if (disabled || !refocusEnabled) {
      return
    }
    const intervalId = setInterval(() => {
      if (!isBarcodeFocused) {
        barcodeInputRef.current?.focus()
      }
    }, BARCODE_INPUT_REFOCUS_MS)
    return () => clearInterval(intervalId)
  }, [disabled, refocusEnabled, isBarcodeFocused])

  return (
    <View
      style={[styles.panel, panelWidth, disabled && styles.panelDisabled]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <View style={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View style={styles.cashierBlock}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.cashierText}>
              <Text style={styles.cashierLabel}>Cashier</Text>
              <Text style={styles.cashierName} numberOfLines={1}>
                {cashierName}
              </Text>
            </View>
          </View>

        </View>

        <View style={styles.ornCard}>
          <Text style={styles.ornLabel}>Current ORN</Text>
          <Text style={styles.ornValue}>{currentOrnDisplay}</Text>
          <Text style={styles.ornTerminal}>Terminal: {terminalName || '-'}</Text>
          <Text style={styles.ornDateTime}>{now.toLocaleString()}</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputCard, styles.qtyField]}>
            <Text style={styles.inputCaption}>Qty</Text>
            <TextInput
              style={[styles.input, styles.qtyInput]}
              value={String(qty)}
              onChangeText={(value) => onQtyChange(Math.max(1, Number(value.replace(/\D/g, '')) || 1))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <View style={[styles.inputCard, styles.barcodeField]}>
            <Text style={styles.inputCaption}>Barcode</Text>
            <TextInput
              ref={barcodeInputRef}
              style={styles.input}
              value={barcode}
              onChangeText={onBarcodeChange}
              onSubmitEditing={onScanSubmit}
              onFocus={() => setIsBarcodeFocused(true)}
              onBlur={() => setIsBarcodeFocused(false)}
              placeholder="Scan barcode"
              placeholderTextColor="#64748b"
              autoFocus
              selectTextOnFocus
              {...(Platform.OS === 'web'
                ? {
                    onKeyDown: (event: KeyboardEvent) => {
                      if (isCustomQtyShortcut(event)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onCustomQty()
                        return
                      }
                      if (isCheckoutShortcut(event)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onCheckout()
                      }
                    },
                  }
                : {})}
            />
          </View>
        </View>

        <View style={styles.totalsCard}>
          <SummaryMoneyRow label="Gross Sales" value={formatMoney(totals.grossSales)} />
          <SummaryMoneyRow label="Discount" value={formatMoney(totals.discountAmount)} />
          <SummaryMoneyRow label="Disc. Rate %" value={formatPercent(totals.discountRate * 100)} />
          <SummaryMoneyRow label="VAT (12.00%)" value={formatMoney(totals.vatAmount)} />
          <SummaryMoneyRow label="Net Total" value={formatMoney(totals.netSales)} />
        </View>

        <View style={styles.divider} />

        <GrandTotalRow value={formatMoney(totals.grandTotal)} />
        <SummaryQtyRow label="Item Qty Total" value={String(totals.itemQtyTotal)} />

        <View style={styles.shortcutRow}>
          <SmallButton label="Ctrl+S Search" onPress={onSearch} />
          <SmallButton label="Ctrl+Q Qty" onPress={onCustomQty} />
          <SmallButton label="Ctrl+D Disc" onPress={onDiscount} />
        </View>
      </View>

      <Pressable style={styles.checkoutButton} onPress={onCheckout}>
        <Text style={styles.checkoutText}>Checkout (Ctrl+Enter)</Text>
      </Pressable>

      <View style={styles.seriesSummaryStrip}>
        <SummaryChip label="Total Sales" value={formatMoney(summary?.total_sales || 0)} />
        <SummaryChip label="Net Sales" value={formatMoney(summary?.net_sales || 0)} />
        <SummaryChip label="VAT" value={formatMoney(summary?.vat_amount || 0)} />
        <SummaryChip label="Qty Sold" value={formatInteger(summary?.qty_sold || 0)} />
      </View>
    </View>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.summaryChipValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function SummaryMoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function GrandTotalRow({ value }: { value: string }) {
  return (
    <View style={styles.grandTotalRow}>
      <View style={styles.grandTotalLabelBlock}>
        <Text style={styles.summaryLabel}>TOTAL SALES</Text>
        <Text style={styles.grandTotalSublabel}>(VAT Inclusive)</Text>
      </View>
      <Text style={styles.grandTotalValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function SummaryQtyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.summaryRow, styles.qtyTotalRow]}>
      <Text style={styles.qtyTotalLabel}>{label}</Text>
      <Text style={styles.qtyTotalValue}>{value}</Text>
    </View>
  )
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.smallButton} onPress={onPress}>
      <Text style={styles.smallButtonText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  panel: {
    flexShrink: 0,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    padding: spacing.sm,
  },
  panelDisabled: {
    opacity: 0.45,
  },
  scrollContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cashierBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0f172a',
    fontFamily: fonts.black,
    fontSize: 11,
  },
  cashierText: {
    flex: 1,
    minWidth: 0,
  },
  cashierLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  cashierName: {
    color: colors.text,
    fontFamily: fonts.extrabold,
    fontSize: 13,
  },
  ornCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  ornLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ornValue: {
    color: colors.accent,
    fontSize: 24,
    fontFamily: fonts.extrabold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  ornTerminal: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.semibold,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  ornDateTime: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'stretch',
  },
  inputCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  qtyField: {
    width: 56,
  },
  barcodeField: {
    flex: 1,
    minWidth: 0,
  },
  inputCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 13,
  },
  qtyInput: {
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  totalsCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    marginRight: spacing.xs,
  },
  summaryValue: {
    flexShrink: 0,
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.bold,
    textAlign: 'right',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginVertical: spacing.sm,
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  grandTotalLabelBlock: {
    flex: 1,
    marginRight: spacing.xs,
  },
  grandTotalSublabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  grandTotalValue: {
    flexShrink: 0,
    color: colors.good,
    fontSize: 28,
    fontFamily: fonts.extrabold,
    textAlign: 'right',
  },
  qtyTotalRow: {
    marginBottom: spacing.sm,
  },
  qtyTotalLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  qtyTotalValue: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.semibold,
    textAlign: 'right',
  },
  shortcutRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    marginTop: spacing.sm,
  },
  smallButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    padding: 4,
    alignItems: 'center',
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 10,
  },
  checkoutButton: {
    backgroundColor: colors.good,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  checkoutText: {
    textAlign: 'center',
    fontFamily: fonts.extrabold,
    color: '#052e16',
    fontSize: 13,
  },
  seriesSummaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  summaryChip: {
    width: '48%',
    minWidth: 100,
    flexGrow: 1,
  },
  summaryChipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  summaryChipValue: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
})

function getInitials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'C'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}
