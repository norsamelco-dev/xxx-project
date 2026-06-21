import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { SalesItemRow, SalesTransactionRow } from '../../types/sales'
import { colors, spacing } from '../../styles/theme'
import { computeCartTotals, formatInteger, formatMoney, normalizePriceVatMode, normalizeVatRateDecimal } from '../../utils/vat'

type Props = {
  visible: boolean
  transaction: SalesTransactionRow | null
  items: SalesItemRow[]
  loadingItems: boolean
  seriesOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onSaveAndReprint: (payload: {
    voidEntire: boolean
    itemIdsToVoid: number[]
    voidReason: string
  }) => Promise<void>
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isVoided(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'Y' || normalized === 'YES' || normalized === '1'
}

function formatOrsi(value: number | string | null | undefined) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return '-'
  }
  return String(numeric).padStart(8, '0')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

export default function TransactionDetailModal({
  visible,
  transaction,
  items,
  loadingItems,
  seriesOpen,
  isSubmitting,
  onClose,
  onSaveAndReprint,
}: Props) {
  const [voidEntire, setVoidEntire] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const [voidReason, setVoidReason] = useState('')

  const transactionVoided = isVoided(transaction?.VOIDED)
  const canVoid = seriesOpen && !transactionVoided

  const activeItems = useMemo(
    () => items.filter((item) => !isVoided(item.VOIDED)),
    [items],
  )

  useEffect(() => {
    if (!visible) {
      return
    }

    setVoidEntire(false)
    setSelectedItemIds([])
    setVoidReason('')
  }, [visible, transaction?.ORSI])

  const discountRate = toNumber(transaction?.discountrate)
  const vatRate = normalizeVatRateDecimal(transaction?.sales_vat_rate)
  const priceVatMode = normalizePriceVatMode(transaction?.sales_price_vat_mode)

  const previewLines = useMemo(() => {
    if (voidEntire || transactionVoided) {
      return []
    }

    return activeItems
      .filter((item) => !selectedItemIds.includes(item.ID))
      .map((item, index) => ({
        id: `preview-${item.ID}-${index}`,
        barcode: item.BARCODE || '',
        name: item.DESCRIPTION || 'Item',
        category: item.CATEGORY || '',
        brand: item.BRAND || '',
        unit: item.UNIT || '',
        batch_id: item.BATCHID || '',
        qty: toNumber(item.QTY),
        price: toNumber(item.PRICE),
        total: toNumber(item.TOTAL),
      }))
  }, [activeItems, selectedItemIds, transactionVoided, voidEntire])

  const previewTotals = useMemo(
    () => computeCartTotals(previewLines, discountRate, vatRate, priceVatMode),
    [discountRate, previewLines, vatRate, priceVatMode],
  )

  const currentGrand = toNumber(transaction?.sales_grandtotal)
  const hasPendingVoids =
    canVoid && (voidEntire || selectedItemIds.some((id) => activeItems.some((item) => item.ID === id)))

  const trimmedReason = voidReason.trim()
  const canSubmit = hasPendingVoids ? trimmedReason.length >= 3 : true

  function toggleItemSelection(itemId: number) {
    if (!canVoid || voidEntire) {
      return
    }

    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    )
  }

  async function handleSaveAndReprint() {
    if (!transaction || !canSubmit) {
      return
    }

    const itemIdsToVoid = voidEntire ? activeItems.map((item) => item.ID) : selectedItemIds

    await onSaveAndReprint({
      voidEntire,
      itemIdsToVoid,
      voidReason: hasPendingVoids ? trimmedReason : '',
    })
  }

  if (!transaction) {
    return null
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={headerRowStyle}>
            <View style={{ flex: 1 }}>
              <Text style={titleStyle}>OR/SI {formatOrsi(transaction.ORSI)}</Text>
              <Text style={metaStyle}>{formatDateTime(transaction.created_at)}</Text>
              <Text style={metaStyle}>{transaction.payment_method || '-'}</Text>
              {transaction.payment_ref_no && transaction.payment_ref_no !== 'N/A' ? (
                <Text style={metaStyle}>Ref: {transaction.payment_ref_no}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} disabled={isSubmitting} style={closeButtonStyle}>
              <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 18 }}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: Platform.OS === 'web' ? 520 : 440 }} showsVerticalScrollIndicator>
            <View style={totalsCompareStyle}>
              <TotalsBlock label="Current grand total" value={formatMoney(currentGrand)} emphasize />
              <Text style={{ color: colors.textMuted, fontSize: 18, alignSelf: 'center' }}>→</Text>
              <TotalsBlock
                label={hasPendingVoids ? 'Preview after save' : 'Grand total'}
                value={formatMoney(hasPendingVoids ? previewTotals.grandTotal : currentGrand)}
                emphasize={hasPendingVoids}
                accent={hasPendingVoids}
              />
            </View>

            {hasPendingVoids ? (
              <View style={previewDetailStyle}>
                <Text style={metaStyle}>
                  Preview: Gross {formatMoney(previewTotals.grossSales)} · VAT {formatMoney(previewTotals.vatAmount)} ·
                  Net {formatMoney(previewTotals.netSales)}
                </Text>
              </View>
            ) : null}

            {canVoid ? (
              <View style={sectionStyle}>
                <Pressable
                  style={[checkboxRowStyle, voidEntire && checkboxRowActiveStyle]}
                  onPress={() => {
                    setVoidEntire((current) => !current)
                    setSelectedItemIds([])
                  }}
                  disabled={isSubmitting}
                >
                  <View style={[checkboxBoxStyle, voidEntire && checkboxBoxCheckedStyle]} />
                  <Text style={checkboxLabelStyle}>Void entire OR/SI (cancel all active lines)</Text>
                </Pressable>

                <Text style={sectionLabelStyle}>Select lines to void</Text>
                <Text style={metaStyle}>Check items to simulate partial void before saving.</Text>
              </View>
            ) : null}

            {loadingItems ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
            ) : (
              <View style={sectionStyle}>
                {items.map((item) => {
                  const itemVoided = isVoided(item.VOIDED)
                  const marked = voidEntire || selectedItemIds.includes(item.ID)
                  const selectable = canVoid && !itemVoided

                  return (
                    <View
                      key={item.ID}
                      style={[
                        itemCardStyle,
                        itemVoided && { opacity: 0.55 },
                        marked && selectable && itemMarkedStyle,
                      ]}
                    >
                      {selectable ? (
                        <Pressable
                          style={checkboxRowStyle}
                          onPress={() => toggleItemSelection(item.ID)}
                          disabled={isSubmitting || voidEntire}
                        >
                          <View style={[checkboxBoxStyle, marked && checkboxBoxCheckedStyle]} />
                        </Pressable>
                      ) : (
                        <View style={{ width: 22 }} />
                      )}

                      <View style={{ flex: 1 }}>
                        <Text style={itemTitleStyle}>
                          {item.DESCRIPTION || 'Item'}
                          {itemVoided ? ' · VOIDED' : ''}
                        </Text>
                        <Text style={metaStyle}>
                          #{item.ID} · {item.BARCODE || '-'} · Batch {item.BATCHID || '-'}
                        </Text>
                        <Text style={metaStyle}>
                          Qty {formatInteger(toNumber(item.QTY))} × {formatMoney(toNumber(item.PRICE))} ={' '}
                          {formatMoney(toNumber(item.TOTAL))}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}

            {hasPendingVoids ? (
              <View style={sectionStyle}>
                <Text style={sectionLabelStyle}>Void reason (required)</Text>
                <TextInput
                  style={reasonInputStyle}
                  value={voidReason}
                  onChangeText={setVoidReason}
                  placeholder="Enter reason for void"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSubmitting}
                  multiline
                />
              </View>
            ) : null}

            {!seriesOpen && !transactionVoided ? (
              <Text style={[metaStyle, { color: colors.warning }]}>
                Series is closed — void is disabled. You can still reprint.
              </Text>
            ) : null}

            {transactionVoided ? (
              <Text style={metaStyle}>This OR/SI is fully voided. Reprint uses saved receipt data.</Text>
            ) : null}
          </ScrollView>

          <View style={footerStyle}>
            <Pressable onPress={onClose} disabled={isSubmitting} style={secondaryButtonStyle}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSaveAndReprint()}
              disabled={isSubmitting || !canSubmit}
              style={[primaryButtonStyle, (isSubmitting || !canSubmit) && { opacity: 0.45 }]}
            >
              <Text style={{ color: '#052e16', fontWeight: '800' }}>
                {isSubmitting
                  ? 'Working...'
                  : hasPendingVoids
                    ? 'Save voids & reprint'
                    : 'Reprint receipt'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function TotalsBlock({
  label,
  value,
  emphasize = false,
  accent = false,
}: {
  label: string
  value: string
  emphasize?: boolean
  accent?: boolean
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <Text
        style={{
          color: accent ? colors.good : colors.text,
          fontWeight: emphasize ? '800' : '600',
          fontSize: emphasize ? 18 : 15,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

const overlayStyle = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.6)',
  justifyContent: 'center' as const,
  padding: spacing.lg,
}

const modalStyle = {
  backgroundColor: colors.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
  width: '100%' as const,
  maxWidth: 720,
  alignSelf: 'center' as const,
}

const headerRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: spacing.md,
  marginBottom: spacing.md,
}

const titleStyle = {
  color: colors.text,
  fontWeight: '800' as const,
  fontSize: 20,
}

const metaStyle = {
  color: colors.textMuted,
  fontSize: 12,
  marginTop: 2,
  lineHeight: 18,
}

const closeButtonStyle = {
  padding: spacing.xs,
}

const totalsCompareStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.md,
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  padding: spacing.md,
  marginBottom: spacing.sm,
}

const previewDetailStyle = {
  marginBottom: spacing.md,
}

const sectionStyle = {
  marginBottom: spacing.md,
}

const sectionLabelStyle = {
  color: colors.text,
  fontWeight: '700' as const,
  fontSize: 13,
  marginBottom: spacing.xs,
}

const checkboxRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.sm,
  marginBottom: spacing.sm,
}

const checkboxRowActiveStyle = {
  opacity: 1,
}

const checkboxBoxStyle = {
  width: 18,
  height: 18,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: colors.border,
  backgroundColor: colors.surface,
}

const checkboxBoxCheckedStyle = {
  borderColor: colors.accent,
  backgroundColor: colors.accent,
}

const checkboxLabelStyle = {
  color: colors.text,
  fontWeight: '600' as const,
  fontSize: 13,
  flex: 1,
}

const itemCardStyle = {
  flexDirection: 'row' as const,
  gap: spacing.sm,
  alignItems: 'flex-start' as const,
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.sm,
  marginBottom: spacing.xs,
}

const itemMarkedStyle = {
  borderColor: colors.bad,
  backgroundColor: '#450a0a',
}

const itemTitleStyle = {
  color: colors.text,
  fontWeight: '600' as const,
  fontSize: 13,
}

const reasonInputStyle = {
  backgroundColor: colors.surfaceAlt,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  color: colors.text,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  minHeight: 72,
  textAlignVertical: 'top' as const,
}

const footerStyle = {
  flexDirection: 'row' as const,
  justifyContent: 'flex-end' as const,
  gap: spacing.sm,
  marginTop: spacing.md,
  paddingTop: spacing.md,
  borderTopWidth: 1,
  borderTopColor: colors.border,
}

const secondaryButtonStyle = {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
}

const primaryButtonStyle = {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderRadius: 8,
  backgroundColor: colors.good,
}
