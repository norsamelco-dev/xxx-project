import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native'
import { getPosReceiptContextPublic } from '../../services/api/posApi'
import { getApiBaseUrl } from '../../services/api/client'
import type { ReceiptHeading } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  branchCode?: string
  onClose: () => void
}

function resolveImageUrl(path: string | null | undefined) {
  if (!path) {
    return null
  }
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export default function AboutModal({ visible, branchCode, onClose }: Props) {
  const [heading, setHeading] = useState<ReceiptHeading | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError('')

    void getPosReceiptContextPublic(branchCode)
      .then((data) => {
        if (isMounted) {
          setHeading(data)
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load developer details.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [visible, branchCode])

  const logoUri = resolveImageUrl(heading?.developer_logo_path)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>About us</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
          ) : error ? (
            <Text style={{ color: colors.bad, marginBottom: spacing.md }}>{error}</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  style={{ width: 120, height: 48, resizeMode: 'contain', alignSelf: 'center' }}
                />
              ) : null}
              <DetailRow label="Developer" value={heading?.developer || '—'} />
              <DetailRow label="Software version" value={heading?.softwareversion || '—'} />
              <DetailRow label="Accreditation no." value={heading?.accreditation_no || '—'} />
              <DetailRow label="Contact" value={heading?.contactdetail || '—'} />
            </View>
          )}

          <Pressable
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              padding: spacing.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={onClose}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}
