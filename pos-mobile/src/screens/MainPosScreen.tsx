import { useCallback, useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import TopBar from '../components/pos/TopBar'
import CartList from '../components/pos/CartList'
import RightSummaryPanel from '../components/pos/RightSummaryPanel'
import TerminalFooter from '../components/pos/TerminalFooter'
import ProductSearchModal from '../components/modals/ProductSearchModal'
import CustomQtyModal from '../components/modals/CustomQtyModal'
import DiscountModal from '../components/modals/DiscountModal'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePosSession } from '../context/PosSessionContext'
import { lookupProduct } from '../services/api/posApi'
import type { RootStackParamList } from '../navigation/types'
import type { ProductLookup } from '../types/pos'

type Props = NativeStackScreenProps<RootStackParamList, 'MainPos'>

export default function MainPosScreen({ navigation }: Props) {
  const { user, logout } = useAuth()
  const {
    config,
    activeSeriesNo,
    seriesOptions,
    currentOrnDisplay,
    summary,
    refreshSeries,
    selectSeries,
    createNewSeries,
    refreshSummary,
  } = usePosSession()
  const { lines, pendingQty, totals, setPendingQty, setDiscountRate, addLine, removeLine, emptyCart } = useCart()
  const [barcode, setBarcode] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [qtyOpen, setQtyOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)

  useEffect(() => {
    if (config?.terminal_name) {
      void refreshSeries()
      void refreshSummary()
    }
  }, [config?.terminal_name, activeSeriesNo, refreshSeries, refreshSummary])

  const addProduct = useCallback(
    (product: ProductLookup) => {
      if (!activeSeriesNo) {
        Alert.alert('Sales series required', 'Create or select a sales series before adding items.')
        return
      }

      addLine({
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        batch_id: product.batch_id,
        price: product.selling_price,
        qty: pendingQty,
      })
      setBarcode('')
    },
    [activeSeriesNo, addLine, pendingQty],
  )

  async function handleScanSubmit() {
    if (!barcode.trim()) {
      return
    }

    try {
      const product = await lookupProduct(barcode.trim())
      addProduct(product)
    } catch (error) {
      Alert.alert('Product not found', error instanceof Error ? error.message : 'Lookup failed.')
    }
  }

  function handleCheckoutPress() {
    if (!activeSeriesNo) {
      Alert.alert('Sales series required', 'Create or select a sales series first.')
      return
    }

    if (!lines.length) {
      Alert.alert('Empty cart', 'Add at least one item before checkout.')
      return
    }

    navigation.navigate('Checkout')
  }

  if (!config) {
    return null
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <TopBar
        seriesOptions={seriesOptions}
        activeSeriesNo={activeSeriesNo}
        summary={summary}
        onSelectSeries={selectSeries}
        onCreateSeries={() => {
          void createNewSeries().catch((error) => {
            Alert.alert('Unable to create series', error instanceof Error ? error.message : 'Failed.')
          })
        }}
        onXReport={() => navigation.navigate('XReport')}
        onZReport={() => navigation.navigate('ZReport')}
        onUtilities={() => navigation.navigate('Utilities')}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <CartList lines={lines} onRemove={removeLine} />
        </View>
        <RightSummaryPanel
          currentOrnDisplay={currentOrnDisplay}
          barcode={barcode}
          qty={pendingQty}
          totals={totals}
          cashierName={user?.fullName || user?.username || 'Cashier'}
          onLogout={() => {
            void logout().finally(() => navigation.replace('Login'))
          }}
          onBarcodeChange={setBarcode}
          onQtyChange={setPendingQty}
          onScanSubmit={() => void handleScanSubmit()}
          onCheckout={handleCheckoutPress}
          onCustomQty={() => setQtyOpen(true)}
          onDiscount={() => setDiscountOpen(true)}
          onSearch={() => setSearchOpen(true)}
        />
      </View>
      <TerminalFooter config={config} onEmptyCart={emptyCart} />
      <ProductSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={addProduct} />
      <CustomQtyModal
        visible={qtyOpen}
        currentQty={pendingQty}
        onClose={() => setQtyOpen(false)}
        onApply={setPendingQty}
      />
      <DiscountModal
        visible={discountOpen}
        currentRate={totals.discountRate}
        onClose={() => setDiscountOpen(false)}
        onApply={setDiscountRate}
      />
    </View>
  )
}
