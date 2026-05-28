import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  isSubmitting?: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export default function VoidReasonModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  isSubmitting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (visible) {
      setReason('')
    }
  }, [visible])

  const trimmed = reason.trim()
  const canSubmit = trimmed.length >= 3 && !isSubmitting

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            maxWidth: 420,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: spacing.sm }}>
            {title}
          </Text>
          <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md }}>{message}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>Reason (required)</Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              color: colors.text,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.md,
            }}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter void reason"
            placeholderTextColor={colors.textMuted}
            editable={!isSubmitting}
            multiline
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
            <Pressable
              onPress={onCancel}
              disabled={isSubmitting}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(trimmed)}
              disabled={!canSubmit}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 8,
                backgroundColor: canSubmit ? colors.bad : colors.surfaceAlt,
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{isSubmitting ? 'Working...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
