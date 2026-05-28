import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import type { TextInput as TextInputType } from 'react-native'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  currentQty: number
  onClose: () => void
  onApply: (qty: number) => void
}

function sanitizeQtyInput(value: string) {
  return value.replace(/\D/g, '')
}

export default function CustomQtyModal({ visible, onClose, currentQty, onApply }: Props) {
  const [qty, setQty] = useState(String(currentQty))
  const inputRef = useRef<TextInputType>(null)

  const applyQty = useCallback(() => {
    const parsed = Math.max(1, Number(sanitizeQtyInput(qty)) || 1)
    onApply(parsed)
    onClose()
  }, [onApply, onClose, qty])

  useEffect(() => {
    if (!visible) {
      return
    }

    setQty(String(currentQty))
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)

    return () => clearTimeout(focusTimer)
  }, [visible, currentQty])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            width: '100%',
            maxWidth: 300,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: '700',
              marginBottom: spacing.xs,
              textAlign: 'center',
            }}
          >
            Custom Quantity
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              marginBottom: spacing.sm,
              textAlign: 'center',
            }}
          >
            Numbers only · Enter to apply
          </Text>
          <TextInput
            ref={inputRef}
            style={{
              backgroundColor: colors.surfaceAlt,
              color: colors.text,
              borderRadius: 8,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.sm,
              width: '100%',
              maxWidth: 160,
              fontSize: 22,
              fontWeight: '700',
              textAlign: 'center',
            }}
            value={qty}
            onChangeText={(value) => setQty(sanitizeQtyInput(value))}
            onSubmitEditing={applyQty}
            keyboardType="number-pad"
            returnKeyType="done"
            submitBehavior="submit"
            autoFocus
            selectTextOnFocus
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%', justifyContent: 'center' }}>
            <Pressable
              style={{
                backgroundColor: colors.accent,
                borderRadius: 8,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                minWidth: 88,
              }}
              onPress={applyQty}
            >
              <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a', fontSize: 13 }}>Apply</Text>
            </Pressable>
            <Pressable
              style={{
                borderRadius: 8,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                minWidth: 88,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={onClose}
            >
              <Text style={{ textAlign: 'center', color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
