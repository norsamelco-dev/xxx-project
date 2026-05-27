import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { PosConfig } from '../../types/config'
import { colors, spacing } from '../../styles/theme'

type Props = {
  config: PosConfig
  onEmptyCart: () => void
}

export default function TerminalFooter({ config, onEmptyCart }: Props) {
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
      <Pressable style={{ backgroundColor: colors.bad, borderRadius: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }} onPress={onEmptyCart}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Empty Cart</Text>
      </Pressable>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
        Ctrl+Q Qty · Ctrl+S Search · Ctrl+D Discount · Ctrl+Enter Checkout
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontSize: 12 }}>Terminal: {config.terminal_name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{config.branch}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          SN: {config.serial_no} · PTU: {config.ptu_no} · {now.toLocaleString()}
        </Text>
      </View>
    </View>
  )
}
