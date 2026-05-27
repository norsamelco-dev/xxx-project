import { useState } from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  currentQty: number
  onClose: () => void
  onApply: (qty: number) => void
}

export default function CustomQtyModal({ visible, onClose, currentQty, onApply }: Props) {
  const [qty, setQty] = useState(String(currentQty))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>Custom Quantity</Text>
          <TextInput
            style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md }}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
          />
          <Pressable
            style={{ backgroundColor: colors.accent, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
            onPress={() => {
              onApply(Math.max(1, Number(qty) || 1))
              onClose()
            }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>Apply</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
