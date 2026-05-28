import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { getStartingBalance } from '../../services/api/posApi'
import { colors, spacing } from '../../styles/theme'
import { formatAmount, parseMoneyInput } from '../../utils/vat'

type Props = {
  visible: boolean
  seriesNo: string | null
  isSubmitting?: boolean
  onClose: () => void
  onConfirm: (startingBalance: number) => void
}

export default function StartingBalanceModal({
  visible,
  seriesNo,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !seriesNo) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setValue('')

    void getStartingBalance(seriesNo)
      .then((data) => {
        if (cancelled) {
          return
        }

        if (data.starting_balance !== null && Number.isFinite(data.starting_balance)) {
          setValue(formatAmount(data.starting_balance))
        }
      })
      .catch((fetchError) => {
        if (cancelled) {
          return
        }

        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load starting balance.'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [visible, seriesNo])

  function handleClose() {
    if (isSubmitting) {
      return
    }
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, width: '100%', maxWidth: 520 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm }}>
            Enter Starting Balance
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
            Sales Series: {seriesNo || 'N/A'}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
          ) : (
            <TextInput
              style={{
                backgroundColor: colors.surfaceAlt,
                color: colors.text,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
              value={value}
              onChangeText={(nextValue) => {
                setValue(nextValue)
                if (error) {
                  setError('')
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              editable={!isSubmitting}
            />
          )}

          {error ? <Text style={{ color: colors.bad, marginBottom: spacing.sm }}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surfaceAlt,
                borderRadius: 8,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: isSubmitting ? 0.5 : 1,
              }}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.textMuted }}>Close</Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                padding: spacing.md,
                opacity: loading || isSubmitting ? 0.6 : 1,
              }}
              disabled={loading || isSubmitting}
              onPress={() => {
                const parsed = parseMoneyInput(value)
                if (!Number.isFinite(parsed) || parsed < 0) {
                  setError('Starting balance must be a valid non-negative amount.')
                  return
                }
                onConfirm(parsed)
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                {isSubmitting ? 'Saving...' : 'Save Starting Balance'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
