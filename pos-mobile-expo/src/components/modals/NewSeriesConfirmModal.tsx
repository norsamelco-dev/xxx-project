import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  isSubmitting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function NewSeriesConfirmModal({
  visible,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.lg,
            maxHeight: '85%',
            width: '100%',
            maxWidth: 560,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>
            Create New Sales Series
          </Text>
          <ScrollView style={{ marginBottom: spacing.md }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: spacing.md }}>
              Are you sure you want to create a new sales series?
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.md }}>
              Creating a new sales series means the current cashier session or shift will be closed. Once the new
              series is created, the cashier must perform a Lock Batch / Lock Series process to finalize and secure
              all transactions under the current sales series.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22 }}>
              This action indicates that the cashier's shift is completed and a new transaction series will begin.
            </Text>
          </ScrollView>
          <Pressable
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onPress={onConfirm}
            disabled={isSubmitting}
          >
            <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
              {isSubmitting ? 'Creating...' : 'Confirm / Create New Series'}
            </Text>
          </Pressable>
          <Pressable onPress={onCancel} disabled={isSubmitting}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
