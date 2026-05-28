import { Modal, Pressable, Text, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
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
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 480,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surfaceAlt,
                borderRadius: 8,
                padding: spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={onCancel}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: destructive ? colors.bad : colors.accent,
                borderRadius: 8,
                padding: spacing.md,
              }}
              onPress={onConfirm}
            >
              <Text style={{ textAlign: 'center', fontWeight: '700', color: destructive ? '#fff' : '#0f172a' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
