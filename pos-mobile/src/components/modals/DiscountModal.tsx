import { useState } from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  currentRate: number
  onClose: () => void
  onApply: (ratePercent: number) => void
}

export default function DiscountModal({ visible, onClose, currentRate, onApply }: Props) {
  const [rate, setRate] = useState(String((currentRate * 100).toFixed(2)))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>Discount %</Text>
          <TextInput
            style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md }}
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
          />
          <Pressable
            style={{ backgroundColor: colors.accent, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
            onPress={() => {
              onApply(Math.max(0, Number(rate) || 0) / 100)
              onClose()
            }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>Apply Discount</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
