import { Pressable, Text, TextInput, View } from 'react-native'
import type { CartTotals } from '../../types/cart'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  currentOrnDisplay: string
  barcode: string
  qty: number
  totals: CartTotals
  cashierName: string
  onLogout: () => void
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
  barcode,
  qty,
  totals,
  cashierName,
  onLogout,
  onBarcodeChange,
  onQtyChange,
  onScanSubmit,
  onCheckout,
  onCustomQty,
  onDiscount,
  onSearch,
}: Props) {
  const initials = getInitials(cashierName)

  return (
    <View style={{ width: 320, backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#0f172a', fontWeight: '900' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cashier</Text>
            <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
              {cashierName}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onLogout}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
          }}
          accessibilityLabel="Logout"
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>⎋</Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Current ORN</Text>
      <Text style={{ color: colors.accent, fontSize: 28, fontWeight: '800', marginBottom: spacing.md }}>{currentOrnDisplay}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>Scan Barcode</Text>
      <TextInput
        style={inputStyle}
        value={barcode}
        onChangeText={onBarcodeChange}
        onSubmitEditing={onScanSubmit}
        placeholder="Scan or type barcode"
        placeholderTextColor="#64748b"
        autoFocus
      />
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>QTY</Text>
      <TextInput
        style={inputStyle}
        value={String(qty)}
        onChangeText={(value) => onQtyChange(Math.max(1, Number(value) || 1))}
        keyboardType="number-pad"
      />
      <SummaryRow label="Gross Sales" value={formatMoney(totals.grossSales)} />
      <SummaryRow label="Discount" value={formatMoney(totals.discountAmount)} />
      <SummaryRow label="Disc. Rate %" value={`${(totals.discountRate * 100).toFixed(2)}%`} />
      <SummaryRow label="VAT (12.00%)" value={formatMoney(totals.vatAmount)} />
      <SummaryRow label="Net Total" value={formatMoney(totals.netSales)} bold />
      <SummaryRow label="Total Sales (VAT Inclusive)" value={formatMoney(totals.grandTotal)} bold />
      <SummaryRow label="Item Qty Total" value={String(totals.itemQtyTotal)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        <SmallButton label="Ctrl+S Search" onPress={onSearch} />
        <SmallButton label="Ctrl+Q Qty" onPress={onCustomQty} />
        <SmallButton label="Ctrl+D Disc" onPress={onDiscount} />
      </View>
      <Pressable style={{ backgroundColor: colors.good, borderRadius: 8, padding: spacing.md, marginTop: spacing.lg }} onPress={onCheckout}>
        <Text style={{ textAlign: 'center', fontWeight: '800', color: '#052e16' }}>Checkout (Ctrl+Enter)</Text>
      </Pressable>
    </View>
  )
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: bold ? '700' : '500' }}>{value}</Text>
    </View>
  )
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={{ backgroundColor: colors.surfaceAlt, borderRadius: 6, padding: spacing.sm }} onPress={onPress}>
      <Text style={{ color: colors.text, fontSize: 11 }}>{label}</Text>
    </Pressable>
  )
}

const inputStyle = {
  backgroundColor: colors.surfaceAlt,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  color: colors.text,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  marginBottom: spacing.md,
}

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
