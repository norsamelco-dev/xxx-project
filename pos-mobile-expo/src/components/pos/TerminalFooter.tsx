import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { PosConfig } from '../../types/config'
import type { PosSummary } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  config: PosConfig
  summary: PosSummary | null
  cartDisabled?: boolean
  onEmptyCart: () => void
}

export default function TerminalFooter({ config, summary, cartDisabled = false, onEmptyCart }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
            backgroundColor: colors.surfaceAlt,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <SummaryChip label="Total Sales" value={formatMoney(summary?.total_sales || 0)} />
          <SummaryChip label="Net Sales" value={formatMoney(summary?.net_sales || 0)} />
          <SummaryChip label="VAT" value={formatMoney(summary?.vat_amount || 0)} />
          <SummaryChip label="Qty Sold" value={String(summary?.qty_sold || 0)} />
        </View>
        <Pressable
          style={{
            backgroundColor: colors.bad,
            borderRadius: 8,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            opacity: cartDisabled ? 0.45 : 1,
          }}
          onPress={onEmptyCart}
          disabled={cartDisabled}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Empty Cart</Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
        Ctrl+Q Qty · Ctrl+S Search · Ctrl+D Discount · Ctrl+Enter Checkout
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 12 }}>Terminal: {config.terminal_name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{config.branch}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          MIN: {config.min_number} · SN: {config.serial_no} · PTU: {config.ptu_no} · {now.toLocaleString()}
        </Text>
      </View>
    </View>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </View>
  )
}
