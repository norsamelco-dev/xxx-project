import { Image, Platform, ScrollView, Text, View } from 'react-native'
import { RECEIPT_WIDTH } from '../../services/printer/layouts/printLayoutUtils'
import type { PrintLogoAlign } from '../../utils/printLogo'
import { colors, spacing } from '../../styles/theme'

const PAPER_WIDTH = 302

type Props = {
  previewText: string
  layoutLabel: string
  marginLeft?: number
  marginRight?: number
  marginTop?: number
  marginBottom?: number
  logoUri?: string | null
  logoWidthPercent?: number
  logoAlign?: PrintLogoAlign
  /** Taller scroll area when preview is shown beside margin controls. */
  expandedScroll?: boolean
  /** Shrink scroll area to fit inside a flex-sized modal column. */
  fitInModal?: boolean
}

export default function PrintLayoutPreview({
  previewText,
  layoutLabel,
  marginLeft = 0,
  marginRight = 0,
  marginTop = 0,
  marginBottom = 0,
  logoUri = null,
  logoWidthPercent = 0,
  logoAlign = 'center',
  expandedScroll = false,
  fitInModal = false,
}: Props) {
  const monospaceFont = Platform.select({
    ios: 'Courier',
    android: 'monospace',
    default: 'monospace',
  })

  const scrollMaxHeight = expandedScroll ? (Platform.OS === 'web' ? 720 : 600) : 420
  const useFlexHeight = fitInModal || expandedScroll
  const showLogo = Boolean(logoUri && logoWidthPercent > 0)
  const logoDisplayWidth = Math.round((PAPER_WIDTH * logoWidthPercent) / 100)

  return (
    <View
      style={{
        alignItems: useFlexHeight ? 'stretch' : 'center',
        flex: useFlexHeight ? 1 : undefined,
        minHeight: fitInModal ? 0 : undefined,
        height: fitInModal ? '100%' : undefined,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          marginBottom: spacing.sm,
          textAlign: useFlexHeight ? 'left' : 'center',
        }}
      >
        {layoutLabel} · 80mm · {RECEIPT_WIDTH} chars · L{marginLeft} R{marginRight} T{marginTop} B{marginBottom}
        {showLogo ? ` · Logo ${logoWidthPercent}%` : ''}
      </Text>
      <View
        style={{
          width: PAPER_WIDTH,
          maxWidth: '100%',
          alignSelf: useFlexHeight ? 'flex-start' : 'center',
          backgroundColor: '#ffffff',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: '#cbd5e1',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.md,
          flex: useFlexHeight ? 1 : undefined,
          minHeight: fitInModal ? 0 : expandedScroll ? 320 : undefined,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          style={fitInModal ? { flex: 1, minHeight: 0 } : { maxHeight: scrollMaxHeight }}
          contentContainerStyle={fitInModal ? { flexGrow: 1 } : undefined}
          showsVerticalScrollIndicator
        >
          {showLogo ? (
            <View
              style={{
                width: '100%',
                marginBottom: spacing.sm,
                alignItems:
                  logoAlign === 'left' ? 'flex-start' : logoAlign === 'right' ? 'flex-end' : 'center',
              }}
            >
              <Image
                source={{ uri: logoUri || undefined }}
                style={{
                  width: logoDisplayWidth,
                  maxWidth: '100%',
                  height: 72,
                }}
                resizeMode="contain"
              />
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: monospaceFont,
              fontSize: 11,
              lineHeight: 14,
              color: '#0f172a',
              ...(Platform.OS === 'web'
                ? {
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }
                : {}),
            }}
          >
            {previewText}
          </Text>
        </ScrollView>
      </View>
    </View>
  )
}
