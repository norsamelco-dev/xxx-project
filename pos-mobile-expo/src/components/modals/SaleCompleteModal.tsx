import { Modal, Pressable, Text, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  visible: boolean
  orsiDisplay: string
  nextOrnDisplay: string
  grandTotal: number
  change: number
  printError?: string | null
  receiptPrinted?: boolean
  onClose: () => void
}

export default function SaleCompleteModal({
  visible,
  orsiDisplay,
  nextOrnDisplay,
  grandTotal,
  change,
  printError,
  receiptPrinted = false,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
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
            maxWidth: 420,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.good, fontSize: 40, marginBottom: spacing.sm }}>✓</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs }}>
            Sale Completed
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 }}>
            The cart has been cleared. You can start the next sale.
          </Text>

          <View
            style={{
              width: '100%',
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              marginBottom: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Row label="ORN used" value={orsiDisplay} emphasize />
            <Row label="Next ORN" value={nextOrnDisplay} emphasize />
            <Row label="Grand total" value={formatMoney(grandTotal)} />
            <Row label="Change" value={formatMoney(change)} />
          </View>

          {printError ? (
            <Text style={{ color: colors.warning, fontSize: 12, textAlign: 'center', marginBottom: spacing.md, lineHeight: 18 }}>
              Sale was saved, but the receipt could not be printed: {printError}
            </Text>
          ) : receiptPrinted ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: spacing.md }}>
              Receipt sent to printer.
            </Text>
          ) : null}

          <Pressable
            style={{
              width: '100%',
              backgroundColor: colors.accent,
              borderRadius: 8,
              padding: spacing.md,
              alignItems: 'center',
            }}
            onPress={onClose}
          >
            <Text style={{ color: '#0f172a', fontWeight: '800' }}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function Row({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: emphasize ? 16 : 13, fontWeight: emphasize ? '800' : '600' }}>
        {value}
      </Text>
    </View>
  )
}
