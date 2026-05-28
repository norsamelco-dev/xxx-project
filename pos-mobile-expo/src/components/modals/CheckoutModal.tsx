import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { usePosSession } from '../../context/PosSessionContext'
import { useToast } from '../../context/ToastContext'
import {
  CARD_NETWORKS,
  EWALLET_PROVIDERS,
  PAYMENT_CATEGORIES,
  PAYMENT_REFERENCE_MIN_LENGTH,
  buildPaymentMethod,
  isPaymentReferenceValid,
  requiresPaymentReference,
  usesExactTenderedAmount,
  type CardNetworkId,
  type EwalletProviderId,
  type PaymentCategory,
} from '../../constants/paymentMethods'
import { checkout, getReceiptHeadingPublic } from '../../services/api/posApi'
import { printSalesReceipt } from '../../services/printer/printerService'
import { colors, spacing } from '../../styles/theme'
import { mapCheckoutLinesToCartLines, mapCheckoutTotalsToCartTotals } from '../../utils/checkoutReceipt'
import { alertMessage, confirmAsync } from '../../utils/confirm'
import { formatMoney, parseMoneyInput } from '../../utils/vat'
import SaleCompleteModal from './SaleCompleteModal'

type CompletedSale = {
  orsiDisplay: string
  nextOrnDisplay: string
  grandTotal: number
  change: number
  printError: string | null
  receiptPrinted: boolean
}

type Props = {
  visible: boolean
  onClose: () => void
}

function ButtonWithIcon({
  icon,
  label,
  active = false,
  onPress,
  style,
}: {
  icon: string
  label: string
  active?: boolean
  onPress: () => void
  style?: object
}) {
  return (
    <Pressable
      style={[paymentMethodButtonStyle, active && paymentMethodButtonActiveStyle, style]}
      onPress={onPress}
    >
      <Text style={{ fontSize: 16, marginBottom: 2 }}>{icon}</Text>
      <Text style={[paymentMethodTextStyle, active && paymentMethodTextActiveStyle]}>{label}</Text>
    </Pressable>
  )
}

function ActionButton({
  icon,
  label,
  variant,
  disabled,
  onPress,
}: {
  icon: string
  label: string
  variant: 'primary' | 'secondary'
  disabled?: boolean
  onPress: () => void
}) {
  const isPrimary = variant === 'primary'
  return (
    <Pressable
      style={[
        isPrimary ? primaryButtonStyle : secondaryButtonStyle,
        { flex: 1 },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={actionButtonContentStyle}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
        <Text style={isPrimary ? primaryButtonTextStyle : secondaryButtonTextStyle}>{label}</Text>
      </View>
    </Pressable>
  )
}

export default function CheckoutModal({ visible, onClose }: Props) {
  const { lines, totals, discountRate, emptyCart } = useCart()
  const { config, activeSeriesNo, currentOrnDisplay, setCurrentOrn, refreshSeries, refreshSummary } =
    usePosSession()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('cash')
  const [cardNetwork, setCardNetwork] = useState<CardNetworkId>('VISA')
  const [ewalletProvider, setEwalletProvider] = useState<EwalletProviderId>('GCASH')
  const [amtTendered, setAmtTendered] = useState('0')
  const [paymentRef, setPaymentRef] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)

  const paymentMethod = useMemo(() => {
    if (paymentCategory === 'cash') {
      return buildPaymentMethod('cash')
    }
    if (paymentCategory === 'card') {
      return buildPaymentMethod('card', cardNetwork)
    }
    return buildPaymentMethod('ewallet', ewalletProvider)
  }, [paymentCategory, cardNetwork, ewalletProvider])

  const tenderedValue = parseMoneyInput(amtTendered)
  const change = Math.max(0, (Number.isFinite(tenderedValue) ? tenderedValue : 0) - totals.grandTotal)

  const canCompleteCheckout = useMemo(() => {
    if (paymentCategory === 'cash') {
      return (Number.isFinite(tenderedValue) ? tenderedValue : 0) >= totals.grandTotal
    }
    if (requiresPaymentReference(paymentCategory)) {
      return isPaymentReferenceValid(paymentRef)
    }
    return true
  }, [paymentCategory, tenderedValue, totals.grandTotal, paymentRef])

  useEffect(() => {
    if (visible) {
      setAmtTendered('0')
      setPaymentCategory('cash')
      setCardNetwork('VISA')
      setEwalletProvider('GCASH')
      setPaymentRef('')
      setCompletedSale(null)
    }
  }, [visible])

  function handleDismissComplete() {
    setCompletedSale(null)
    onClose()
  }

  function handlePaymentCategoryChange(category: PaymentCategory) {
    setPaymentCategory(category)
    if (category === 'cash') {
      setAmtTendered('0')
      setPaymentRef('')
      return
    }
    setAmtTendered(String(totals.grandTotal))
    setPaymentRef('')
  }

  async function handleCompleteSale(skipPrinterCheck = false) {
    if (!config) {
      alertMessage('Checkout', 'Terminal is not configured.')
      return
    }

    if (!activeSeriesNo) {
      alertMessage('Checkout', 'Select an active sales series before completing the sale.')
      return
    }

    if (!lines.length) {
      alertMessage('Checkout', 'Cart is empty. Add items before checkout.')
      return
    }

    const tenderedAmount = usesExactTenderedAmount(paymentCategory)
      ? totals.grandTotal
      : Number.isFinite(tenderedValue)
        ? tenderedValue
        : 0

    if (paymentCategory === 'cash' && tenderedAmount < totals.grandTotal) {
      alertMessage('Checkout', `Amount tendered must be at least ${formatMoney(totals.grandTotal)}.`)
      return
    }

    const trimmedRef = paymentRef.trim()

    if (requiresPaymentReference(paymentCategory) && !isPaymentReferenceValid(trimmedRef)) {
      alertMessage(
        'Checkout',
        `Reference no. must be at least ${PAYMENT_REFERENCE_MIN_LENGTH} characters.`,
      )
      return
    }

    if (!skipPrinterCheck && !config.default_printer) {
      const confirmed = await confirmAsync(
        'No default printer',
        'No default printer is configured. Continue without printing?',
        'Continue',
        'Cancel',
      )
      if (!confirmed) {
        return
      }
    }

    setIsSubmitting(true)

    try {
      const result = await checkout({
        machine_name: config.terminal_name,
        sales_series_no: activeSeriesNo,
        payment_method: paymentMethod,
        payment_ref_no: requiresPaymentReference(paymentCategory) ? trimmedRef : 'N/A',
        amt_tendered: tenderedAmount,
        discount_rate: discountRate,
      })

      const receiptLines = mapCheckoutLinesToCartLines(result.lines)
      const receiptTotals = mapCheckoutTotalsToCartTotals(result.totals)

      let printError: string | null = null

      if (config.default_printer) {
        try {
          const heading = await getReceiptHeadingPublic()

          await printSalesReceipt(
            {
              heading,
              config,
              cashierName: user?.fullName || user?.username || 'Cashier',
              cashierId: user?.userId,
              seriesNo: activeSeriesNo,
              orsiDisplay: result.orsi_display,
              lines: receiptLines,
              totals: receiptTotals,
              checkout: result,
              paymentRefNo: requiresPaymentReference(paymentCategory) ? trimmedRef : 'N/A',
              transactionDate: new Date(),
            },
            config.default_printer,
            config.default_printer_id,
            config.default_printer_connection,
          )
        } catch (error) {
          printError = error instanceof Error ? error.message : 'Receipt print failed.'
        }
      }

      setCurrentOrn(result.next_orsi)
      emptyCart()
      await refreshSeries()
      await refreshSummary()

      setCompletedSale({
        orsiDisplay: result.orsi_display,
        nextOrnDisplay: result.next_orsi_display,
        grandTotal: result.totals.grandTotal,
        change: result.amt_change,
        printError,
        receiptPrinted: Boolean(config.default_printer) && !printError,
      })

      if (printError) {
        showToast('Sale saved, but receipt print failed.', 'error')
      } else {
        showToast(`Sale complete — ORN ${result.orsi_display}`, 'info')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete sale.'
      alertMessage('Checkout failed', message)
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SaleCompleteModal
        visible={visible && completedSale !== null}
        orsiDisplay={completedSale?.orsiDisplay ?? ''}
        nextOrnDisplay={completedSale?.nextOrnDisplay ?? ''}
        grandTotal={completedSale?.grandTotal ?? 0}
        change={completedSale?.change ?? 0}
        printError={completedSale?.printError}
        receiptPrinted={completedSale?.receiptPrinted}
        onClose={handleDismissComplete}
      />
      <Modal
        visible={visible && completedSale === null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmitting) {
            onClose()
          }
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 24,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              width: '100%',
              maxWidth: 520,
              maxHeight: '92%',
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={modalHeadingStyle}>
                <Text style={modalHeadingIconStyle}>🛒</Text>
                <Text style={modalHeadingTextStyle}>Checkout</Text>
              </View>
              <Text style={{ color: colors.textMuted, marginBottom: spacing.xs }}>Series: {activeSeriesNo || '-'}</Text>
              <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
                Invoice ORN: {currentOrnDisplay}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.md }}>
                Grand Total: {formatMoney(totals.grandTotal)}
              </Text>

              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>Payment method</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                {PAYMENT_CATEGORIES.map((option) => (
                  <ButtonWithIcon
                    key={option.id}
                    icon={option.icon}
                    label={option.label}
                    active={paymentCategory === option.id}
                    onPress={() => handlePaymentCategoryChange(option.id)}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>

              {paymentCategory === 'card' ? (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>Card type</Text>
                  <View style={subtypeRowStyle}>
                    {CARD_NETWORKS.map((option) => (
                      <Pressable
                        key={option.id}
                        style={[subtypeButtonStyle, cardNetwork === option.id && subtypeButtonActiveStyle]}
                        onPress={() => setCardNetwork(option.id)}
                      >
                        <Text
                          style={[subtypeButtonTextStyle, cardNetwork === option.id && subtypeButtonTextActiveStyle]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {paymentCategory === 'ewallet' ? (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>E-Wallet</Text>
                  <View style={subtypeRowStyle}>
                    {EWALLET_PROVIDERS.map((option) => (
                      <Pressable
                        key={option.id}
                        style={[subtypeButtonStyle, ewalletProvider === option.id && subtypeButtonActiveStyle]}
                        onPress={() => setEwalletProvider(option.id)}
                      >
                        <Text
                          style={[
                            subtypeButtonTextStyle,
                            ewalletProvider === option.id && subtypeButtonTextActiveStyle,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {paymentCategory === 'cash' ? (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>
                    Amount Tendered
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={amtTendered}
                    onChangeText={setAmtTendered}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                    Change: {formatMoney(change)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>Reference no.</Text>
                  <TextInput
                    style={inputStyle}
                    value={paymentRef}
                    onChangeText={setPaymentRef}
                    placeholder={`Min. ${PAYMENT_REFERENCE_MIN_LENGTH} characters`}
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    maxLength={32}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.md }}>
                    Charged: {formatMoney(totals.grandTotal)} · {paymentMethod}
                    {paymentRef.trim().length > 0 && paymentRef.trim().length < PAYMENT_REFERENCE_MIN_LENGTH
                      ? ` · ${PAYMENT_REFERENCE_MIN_LENGTH - paymentRef.trim().length} more character(s) needed`
                      : ''}
                  </Text>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <ActionButton
                  icon="✕"
                  label="Cancel"
                  variant="secondary"
                  disabled={isSubmitting}
                  onPress={onClose}
                />
                <ActionButton
                  icon="✓"
                  label={isSubmitting ? 'Processing...' : 'Checkout'}
                  variant="primary"
                  disabled={isSubmitting || !canCompleteCheckout}
                  onPress={() => void handleCompleteSale()}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const modalHeadingStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.sm,
  marginBottom: spacing.sm,
}

const modalHeadingIconStyle = {
  fontSize: 22,
}

const modalHeadingTextStyle = {
  color: colors.text,
  fontSize: 18,
  fontWeight: '700' as const,
}

const actionButtonContentStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: spacing.sm,
}

const inputStyle = {
  backgroundColor: colors.surfaceAlt,
  color: colors.text,
  borderRadius: 8,
  padding: spacing.md,
  marginBottom: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
}

const paymentMethodButtonStyle = {
  borderRadius: 8,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surfaceAlt,
  alignItems: 'center' as const,
}

const paymentMethodButtonActiveStyle = {
  backgroundColor: colors.accent,
  borderColor: colors.accent,
}

const paymentMethodTextStyle = {
  color: colors.text,
  fontWeight: '600' as const,
  fontSize: 13,
}

const paymentMethodTextActiveStyle = {
  color: '#0f172a',
}

const subtypeRowStyle = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  gap: spacing.sm,
  marginBottom: spacing.md,
}

const subtypeButtonStyle = {
  borderRadius: 8,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surfaceAlt,
}

const subtypeButtonActiveStyle = {
  backgroundColor: colors.accent,
  borderColor: colors.accent,
}

const subtypeButtonTextStyle = {
  color: colors.text,
  fontWeight: '600' as const,
  fontSize: 13,
}

const subtypeButtonTextActiveStyle = {
  color: '#0f172a',
}

const primaryButtonStyle = {
  backgroundColor: colors.good,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
}

const primaryButtonTextStyle = {
  color: '#052e16',
  fontWeight: '800' as const,
}

const secondaryButtonStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
  borderWidth: 1,
  borderColor: colors.border,
}

const secondaryButtonTextStyle = {
  color: colors.textMuted,
  fontWeight: '700' as const,
}
