import { Text, View } from 'react-native'
import type { PosConfig } from '../../types/config'
import { formatBranchLabel } from '../../services/config/terminalConfig'
import { colors, spacing } from '../../styles/theme'

type Props = {
  config: PosConfig
}

export default function TerminalFooter({ config }: Props) {
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
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
        Ctrl+Q Qty · Ctrl+S Search · Ctrl+D Discount · Ctrl+Enter Checkout
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatBranchLabel(config)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          MIN: {config.min_number} · SN: {config.serial_no} · PTU: {config.ptu_no}
        </Text>
      </View>
    </View>
  )
}
