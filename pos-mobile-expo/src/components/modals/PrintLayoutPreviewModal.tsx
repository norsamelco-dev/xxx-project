import { Modal, Platform, Pressable, Text, View } from 'react-native'
import PrintLayoutPreview from '../pos/PrintLayoutPreview'
import type { PrintLogoAlign } from '../../utils/printLogo'
import { colors, spacing } from '../../styles/theme'

export type PrintLayoutPreviewKind = 'test-print' | 'receipt' | 'x-report' | 'z-report'

type Props = {
  visible: boolean
  kind: PrintLayoutPreviewKind
  layoutLabel: string
  previewText: string
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
  logoUri?: string | null
  logoWidthPercent?: number
  logoAlign?: PrintLogoAlign
  saving?: boolean
  onApply: () => void | Promise<void>
  onMarginChange: (field: 'left' | 'right' | 'top' | 'bottom', nextValue: number) => void
  onCancel: () => void
}

type MarginControl = {
  key: 'left' | 'right' | 'top' | 'bottom'
  label: string
  value: number
  max: number
}

export default function PrintLayoutPreviewModal({
  visible,
  kind,
  layoutLabel,
  previewText,
  marginLeft,
  marginRight,
  marginTop,
  marginBottom,
  logoUri = null,
  logoWidthPercent = 0,
  logoAlign = 'center',
  saving = false,
  onApply,
  onMarginChange,
  onCancel,
}: Props) {
  const isSplitPreview = kind === 'receipt' || kind === 'x-report' || kind === 'z-report'
  const title =
    kind === 'test-print'
      ? 'Test print layout preview'
      : kind === 'receipt'
        ? 'Receipt layout preview'
        : kind === 'x-report'
          ? 'X-Reading layout preview'
          : 'Z-Reading layout preview'
  const controls: MarginControl[] = [
    { key: 'left', label: 'Left margin', value: marginLeft, max: 12 },
    { key: 'right', label: 'Right margin', value: marginRight, max: 12 },
    { key: 'top', label: 'Top margin', value: marginTop, max: 20 },
    { key: 'bottom', label: 'Bottom margin', value: marginBottom, max: 20 },
  ]

  const modalMaxWidth = isSplitPreview ? 620 : 480
  const modalMaxHeight = isSplitPreview ? (Platform.OS === 'web' ? 760 : 640) : undefined

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: spacing.md,
          alignItems: 'center',
        }}
        onPress={onCancel}
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
            height: isSplitPreview ? modalMaxHeight : undefined,
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: spacing.xs }}>
            {title}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              marginBottom: isSplitPreview ? spacing.sm : spacing.lg,
              lineHeight: 18,
            }}
          >
            Preview shows the store logo and text that will print on 80mm thermal paper. Logo size and position are set in admin Business Profile Settings.
          </Text>

          {isSplitPreview ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: spacing.md,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                <PrintLayoutPreview
                  previewText={previewText}
                  layoutLabel={layoutLabel}
                  marginLeft={marginLeft}
                  marginRight={marginRight}
                  marginTop={marginTop}
                  marginBottom={marginBottom}
                  logoUri={logoUri}
                  logoWidthPercent={logoWidthPercent}
                  logoAlign={logoAlign}
                  expandedScroll
                  fitInModal
                />
              </View>
              <View style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
                <MarginsPanel controls={controls} saving={saving} onMarginChange={onMarginChange} column />
                <LayoutActionButtons
                  saving={saving}
                  onCancel={onCancel}
                  onApply={onApply}
                  column
                />
              </View>
            </View>
          ) : (
            <>
              <PrintLayoutPreview
                previewText={previewText}
                layoutLabel={layoutLabel}
                marginLeft={marginLeft}
                marginRight={marginRight}
                marginTop={marginTop}
                marginBottom={marginBottom}
                logoUri={logoUri}
                logoWidthPercent={logoWidthPercent}
                logoAlign={logoAlign}
              />
              <MarginsPanel controls={controls} saving={saving} onMarginChange={onMarginChange} />
              <LayoutActionButtons saving={saving} onCancel={onCancel} onApply={onApply} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function LayoutActionButtons({
  saving,
  onCancel,
  onApply,
  column = false,
}: {
  saving: boolean
  onCancel: () => void
  onApply: () => void | Promise<void>
  column?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: column ? spacing.md : spacing.lg,
        width: column ? '100%' : undefined,
      }}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.surfaceAlt,
          borderRadius: 8,
          padding: column ? spacing.sm : spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: saving ? 0.5 : 1,
        }}
        onPress={onCancel}
        disabled={saving}
      >
        <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.textMuted, fontSize: column ? 12 : 14 }}>
          Cancel
        </Text>
      </Pressable>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.accent,
          borderRadius: 8,
          padding: column ? spacing.sm : spacing.md,
          opacity: saving ? 0.5 : 1,
        }}
        onPress={() => void onApply()}
        disabled={saving}
      >
        <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a', fontSize: column ? 12 : 14 }}>
          {saving ? 'Saving...' : 'Apply layout'}
        </Text>
      </Pressable>
    </View>
  )
}

function MarginsPanel({
  controls,
  saving,
  onMarginChange,
  column = false,
}: {
  controls: MarginControl[]
  saving: boolean
  onMarginChange: (field: 'left' | 'right' | 'top' | 'bottom', nextValue: number) => void
  column?: boolean
}) {
  const labelWidth = column ? 76 : 100
  const stepButtonWidth = column ? 32 : 40
  const valueWidth = column ? 32 : undefined

  return (
    <View
      style={{
        flexShrink: column ? 0 : undefined,
        marginTop: column ? 0 : spacing.md,
        padding: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
        alignSelf: column ? 'flex-start' : undefined,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.xs }}>Margins</Text>
      {!column ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
          Adjust receipt spacing before saving layout.
        </Text>
      ) : null}
      {controls.map((control) => (
        <View
          key={control.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: column ? spacing.xs : spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <Text style={{ width: labelWidth, color: colors.textMuted, fontSize: 12 }}>{control.label}</Text>
          <Pressable
            style={{
              width: stepButtonWidth,
              borderRadius: 8,
              paddingVertical: column ? spacing.xs : spacing.sm,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: saving || control.value <= 0 ? 0.5 : 1,
            }}
            onPress={() => onMarginChange(control.key, control.value - 1)}
            disabled={saving || control.value <= 0}
          >
            <Text style={{ textAlign: 'center', color: colors.text, fontWeight: '800' }}>-</Text>
          </Pressable>
          <View
            style={{
              width: valueWidth,
              flex: column ? undefined : 1,
              minWidth: column ? valueWidth : undefined,
              borderRadius: 8,
              paddingVertical: column ? spacing.xs : spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ textAlign: 'center', color: colors.text, fontWeight: '700' }}>{control.value}</Text>
          </View>
          <Pressable
            style={{
              width: stepButtonWidth,
              borderRadius: 8,
              paddingVertical: column ? spacing.xs : spacing.sm,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: saving || control.value >= control.max ? 0.5 : 1,
            }}
            onPress={() => onMarginChange(control.key, control.value + 1)}
            disabled={saving || control.value >= control.max}
          >
            <Text style={{ textAlign: 'center', color: colors.text, fontWeight: '800' }}>+</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}
