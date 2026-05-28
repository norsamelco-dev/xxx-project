import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native'
import PrintLayoutPreview from '../pos/PrintLayoutPreview'
import type { PrintLogoAlign } from '../../utils/printLogo'
import { colors, spacing } from '../../styles/theme'

export type ReportPrintKind = 'X' | 'Z'

type Props = {
  visible: boolean
  kind: ReportPrintKind
  previewText: string
  logoUri?: string | null
  logoWidthPercent?: number
  logoAlign?: PrintLogoAlign
  loading?: boolean
  error?: string | null
  isPrinting?: boolean
  onPrint: () => void | Promise<void>
  onClose: () => void
}

export default function ReportPrintPreviewModal({
  visible,
  kind,
  previewText,
  logoUri = null,
  logoWidthPercent = 0,
  logoAlign = 'center',
  loading = false,
  error = null,
  isPrinting = false,
  onPrint,
  onClose,
}: Props) {
  const title = kind === 'X' ? 'X-Reading Report' : 'Z-Reading Report'
  const layoutLabel = kind === 'X' ? 'X-Reading (80mm)' : 'Z-Reading (80mm)'
  const modalMaxWidth = 520
  const modalMaxHeight = Platform.OS === 'web' ? 760 : 640
  const busy = loading || isPrinting

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: spacing.md,
          alignItems: 'center',
        }}
        onPress={busy ? undefined : onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: modalMaxWidth,
            maxHeight: modalMaxHeight,
            height: modalMaxHeight,
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Text style={{ fontSize: 20 }}>{kind === 'X' ? '📊' : '📋'}</Text>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{title}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 18 }}>
            Review the store logo and report below before printing. This matches the 80mm thermal slip.
          </Text>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textMuted }}>Loading report...</Text>
            </View>
          ) : error ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ color: colors.bad, lineHeight: 20 }}>{error}</Text>
            </View>
          ) : (
            <View style={{ flex: 1, minHeight: 0 }}>
              <PrintLayoutPreview
                previewText={previewText}
                layoutLabel={layoutLabel}
                logoUri={logoUri}
                logoWidthPercent={logoWidthPercent}
                logoAlign={logoAlign}
                expandedScroll
                fitInModal
              />
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              style={[secondaryButtonStyle, { flex: 1 }, busy && { opacity: 0.5 }]}
              onPress={onClose}
              disabled={busy}
            >
              <View style={actionRowStyle}>
                <Text style={{ fontSize: 14 }}>✕</Text>
                <Text style={secondaryButtonTextStyle}>Close</Text>
              </View>
            </Pressable>
            <Pressable
              style={[primaryButtonStyle, { flex: 1 }, (busy || Boolean(error) || !previewText) && { opacity: 0.5 }]}
              onPress={() => void onPrint()}
              disabled={busy || Boolean(error) || !previewText}
            >
              <View style={actionRowStyle}>
                <Text style={{ fontSize: 14 }}>🖨</Text>
                <Text style={primaryButtonTextStyle}>{isPrinting ? 'Printing...' : 'Print'}</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const actionRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: spacing.sm,
}

const primaryButtonStyle = {
  backgroundColor: colors.good,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
}

const primaryButtonTextStyle = {
  color: '#052e16',
  fontWeight: '800' as const,
}

const secondaryButtonStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  padding: spacing.md,
  alignItems: 'center' as const,
  borderWidth: 1,
  borderColor: colors.border,
}

const secondaryButtonTextStyle = {
  color: colors.textMuted,
  fontWeight: '700' as const,
}
