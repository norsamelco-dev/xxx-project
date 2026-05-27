import { useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCart } from '../context/CartContext'
import { usePosSession } from '../context/PosSessionContext'
import { checkout, getReceiptHeadingPublic } from '../services/api/posApi'
import { buildReceiptText, printReceipt } from '../services/printer/printerService'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import { formatMoney } from '../utils/vat'
import { useAuth } from '../context/AuthContext'

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>

export default function CheckoutScreen({ navigation }: Props) {
  const { lines, totals, discountRate, emptyCart } = useCart()
  const { config, activeSeriesNo, setCurrentOrn, refreshSeries, refreshSummary } = usePosSession()
  const { user } = useAuth()
  const [paymentMethod, setPaymentMethod] = useState<'CASH PAYMENT' | 'CARD PAYMENT'>('CASH PAYMENT')
  const [amtTendered, setAmtTendered] = useState(String(totals.grandTotal))
  const [paymentRef, setPaymentRef] = useState('N/A')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const change = Math.max(0, (Number(amtTendered) || 0) - totals.grandTotal)

  async function handleComplete() {
    if (!config || !activeSeriesNo) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await checkout({
        machine_name: config.terminal_name,
        sales_series_no: activeSeriesNo,
        payment_method: paymentMethod,
        payment_ref_no: paymentRef,
        amt_tendered: Number(amtTendered) || 0,
        discount_rate: discountRate,
        lines: lines.map((line) => ({
          barcode: line.barcode,
          qty: line.qty,
          price: line.price,
          batch_id: line.batch_id,
        })),
      })

      const heading = await getReceiptHeadingPublic()
      const receipt = buildReceiptText({
        heading,
        config,
        cashierName: user?.fullName || user?.username || 'Cashier',
        seriesNo: activeSeriesNo,
        orsiDisplay: result.orsi_display,
        lines,
        totals,
        checkout: result,
      })

      await printReceipt(receipt, config.default_printer)
      setCurrentOrn(result.next_orsi)
      emptyCart()
      await refreshSeries()
      await refreshSummary()
      Alert.alert('Checkout complete', `ORN ${result.orsi_display} saved and receipt sent to printer.`)
      navigation.replace('MainPos')
    } catch (error) {
      Alert.alert('Checkout failed', error instanceof Error ? error.message : 'Unable to complete sale.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Checkout</Text>
        <Text style={commonStyles.subtitle}>Series: {activeSeriesNo}</Text>
        <Text style={{ color: '#f8fafc', marginBottom: 8 }}>Grand Total: {formatMoney(totals.grandTotal)}</Text>
        <View style={[commonStyles.row, { marginBottom: 12 }]}>
          <Pressable
            style={[commonStyles.button, paymentMethod === 'CASH PAYMENT' && { opacity: 1 }, paymentMethod !== 'CASH PAYMENT' && commonStyles.buttonSecondary]}
            onPress={() => setPaymentMethod('CASH PAYMENT')}
          >
            <Text style={commonStyles.buttonText}>Cash</Text>
          </Pressable>
          <Pressable
            style={[commonStyles.button, paymentMethod === 'CARD PAYMENT' && { opacity: 1 }, paymentMethod !== 'CARD PAYMENT' && commonStyles.buttonSecondary]}
            onPress={() => setPaymentMethod('CARD PAYMENT')}
          >
            <Text style={commonStyles.buttonTextLight}>Card</Text>
          </Pressable>
        </View>
        {paymentMethod === 'CASH PAYMENT' ? (
          <>
            <Text style={commonStyles.label}>Amount Tendered</Text>
            <TextInput style={commonStyles.input} value={amtTendered} onChangeText={setAmtTendered} keyboardType="decimal-pad" />
            <Text style={{ color: '#94a3b8', marginBottom: 12 }}>Change: {formatMoney(change)}</Text>
          </>
        ) : (
          <>
            <Text style={commonStyles.label}>Card Reference</Text>
            <TextInput style={commonStyles.input} value={paymentRef} onChangeText={setPaymentRef} />
          </>
        )}
        <Pressable style={commonStyles.button} onPress={() => void handleComplete()} disabled={isSubmitting}>
          <Text style={commonStyles.buttonText}>{isSubmitting ? 'Processing...' : 'Complete Sale'}</Text>
        </Pressable>
        <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
          <Text style={commonStyles.buttonTextLight}>Back</Text>
        </Pressable>
      </View>
    </View>
  )
}
