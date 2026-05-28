import { useEffect, useRef, useState } from 'react'
import { Modal, Platform, Pressable, Text, View, type PressableStateCallbackType } from 'react-native'
import { colors, spacing } from '../../styles/theme'

export type MenuDropdownTag = 'required' | 'optional'

export type MenuDropdownItem = {
  id: string
  label: string
  icon?: string
  tag?: MenuDropdownTag
  disabled?: boolean
  selected?: boolean
  onPress: () => void
}

type Anchor = {
  top: number
  left: number
  minWidth: number
}

type Props = {
  label: string
  menuIcon?: string
  items: MenuDropdownItem[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

type PressableStyleState = PressableStateCallbackType & { hovered?: boolean }

function isWebHoverEnabled() {
  return Platform.OS === 'web'
}

function getTriggerStyle({ pressed, hovered }: PressableStyleState, isOpen: boolean) {
  return [
    triggerStyle,
    isOpen && triggerOpenStyle,
    isWebHoverEnabled() && hovered && !isOpen && triggerHoverStyle,
    isWebHoverEnabled() && hovered && isOpen && triggerOpenHoverStyle,
    pressed && triggerPressedStyle,
  ]
}

function getItemStyle(item: MenuDropdownItem, { pressed, hovered }: PressableStyleState) {
  if (item.disabled) {
    return [itemStyle, itemSectionStyle, { opacity: 0.55 }]
  }

  const styles: object[] = [itemStyle]

  if (item.selected) {
    styles.push(itemSelectedStyle)
  }

  if (isWebHoverEnabled() && hovered) {
    styles.push(item.selected ? itemSelectedHoverStyle : itemHoverStyle)
  }

  if (pressed) {
    styles.push(item.selected ? itemSelectedPressedStyle : itemPressedStyle)
  }

  return styles
}

function getItemLabelStyle(item: MenuDropdownItem) {
  if (item.disabled) {
    return [itemLabelStyle, itemSectionLabelStyle]
  }
  if (item.selected) {
    return [itemLabelStyle, itemSelectedLabelStyle]
  }
  return itemLabelStyle
}

function getItemTagStyle(tag: MenuDropdownTag) {
  if (tag === 'required') {
    return [itemTagStyle, itemTagRequiredStyle]
  }
  return [itemTagStyle, itemTagOptionalStyle]
}

function getItemTagLabel(tag: MenuDropdownTag) {
  return tag === 'required' ? 'Required' : 'Optional'
}

export default function MenuDropdown({ label, menuIcon, items, isOpen, onOpen, onClose }: Props) {
  const triggerRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setAnchor(null)
      return
    }

    const frameId = requestAnimationFrame(() => {
      triggerRef.current?.measureInWindow((left, top, width, height) => {
        setAnchor({
          top: top + height + spacing.xs,
          left,
          minWidth: Math.max(width, 240),
        })
      })
    })

    return () => cancelAnimationFrame(frameId)
  }, [isOpen])

  function handleToggle() {
    if (isOpen) {
      onClose()
      return
    }
    onOpen()
  }

  function handleItemPress(item: MenuDropdownItem) {
    if (item.disabled) {
      return
    }
    onClose()
    // Run action after dropdown close to avoid modal-open race conditions
    // (notably for report preview modals on desktop/web).
    setTimeout(() => {
      item.onPress()
    }, 0)
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          style={(state) => getTriggerStyle(state, isOpen)}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
        >
          {menuIcon ? <Text style={triggerIconStyle}>{menuIcon}</Text> : null}
          <Text style={[triggerLabelStyle, isOpen && triggerOpenLabelStyle]}>{label}</Text>
          <Text style={[chevronStyle, isOpen && { color: colors.accent }]}>{isOpen ? '^' : 'v'}</Text>
        </Pressable>
      </View>

      <Modal visible={isOpen && anchor !== null} transparent animationType="fade" onRequestClose={onClose}>
        <View style={overlayStyle}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          {anchor ? (
            <View
              style={{
                position: 'absolute',
                top: anchor.top,
                left: anchor.left,
                minWidth: anchor.minWidth,
              }}
            >
              <View style={panelStyle}>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    style={(state) => getItemStyle(item, state)}
                    onPress={() => handleItemPress(item)}
                    disabled={item.disabled}
                  >
                    {item.icon ? (
                      <Text style={[itemIconStyle, item.selected && itemSelectedIconStyle]}>{item.icon}</Text>
                    ) : null}
                    <Text style={[getItemLabelStyle(item), { flex: 1 }]}>
                      {item.selected ? '✓ ' : ''}
                      {item.label}
                    </Text>
                    {item.tag ? (
                      <View style={getItemTagStyle(item.tag)}>
                        <Text
                          style={[
                            itemTagTextStyle,
                            item.tag === 'required' ? itemTagTextRequiredStyle : itemTagTextOptionalStyle,
                          ]}
                        >
                          {getItemTagLabel(item.tag)}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  )
}

const triggerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.sm,
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
  minWidth: 100,
  ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {}),
}

const triggerOpenStyle = {
  backgroundColor: '#2a3a52',
  borderColor: colors.accent,
}

const triggerHoverStyle = {
  backgroundColor: '#3d4f66',
  borderColor: '#64748b',
}

const triggerOpenHoverStyle = {
  backgroundColor: '#32465f',
  borderColor: '#7dd3fc',
}

const triggerPressedStyle = {
  backgroundColor: '#273449',
  opacity: 0.95,
}

const triggerIconStyle = {
  color: colors.text,
  fontSize: 14,
}

const triggerLabelStyle = {
  color: colors.text,
  fontSize: 12,
  fontWeight: '600' as const,
}

const triggerOpenLabelStyle = {
  color: '#e0f2fe',
}

const chevronStyle = {
  color: colors.textMuted,
  fontSize: 10,
  fontWeight: '700' as const,
  marginLeft: spacing.xs,
}

const overlayStyle = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.08)',
}

const panelStyle = {
  backgroundColor: colors.surface,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  paddingVertical: spacing.xs,
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 24,
  overflow: 'hidden' as const,
}

const itemStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderLeftWidth: 3,
  borderLeftColor: 'transparent',
  ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 120ms ease' } as const) : {}),
}

const itemSectionStyle = {
  borderLeftColor: 'transparent',
  ...(Platform.OS === 'web' ? ({ cursor: 'default' } as const) : {}),
}

const itemHoverStyle = {
  backgroundColor: colors.surfaceAlt,
}

const itemPressedStyle = {
  backgroundColor: '#3d4f66',
}

const itemSelectedStyle = {
  backgroundColor: 'rgba(56, 189, 248, 0.16)',
  borderLeftColor: colors.accent,
}

const itemSelectedHoverStyle = {
  backgroundColor: 'rgba(56, 189, 248, 0.26)',
}

const itemSelectedPressedStyle = {
  backgroundColor: 'rgba(56, 189, 248, 0.34)',
}

const itemIconStyle = {
  color: colors.textMuted,
  fontSize: 14,
  width: 20,
  textAlign: 'center' as const,
}

const itemSelectedIconStyle = {
  color: colors.accent,
}

const itemLabelStyle = {
  color: colors.text,
  fontSize: 13,
  fontWeight: '500' as const,
}

const itemSectionLabelStyle = {
  color: colors.textMuted,
  fontSize: 11,
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
}

const itemSelectedLabelStyle = {
  color: '#e0f2fe',
  fontWeight: '700' as const,
}

const itemTagStyle = {
  borderRadius: 999,
  paddingHorizontal: spacing.sm,
  paddingVertical: 2,
  borderWidth: 1,
  marginLeft: spacing.sm,
}

const itemTagRequiredStyle = {
  backgroundColor: 'rgba(251, 191, 36, 0.14)',
  borderColor: colors.warning,
}

const itemTagOptionalStyle = {
  backgroundColor: colors.surfaceAlt,
  borderColor: colors.border,
}

const itemTagTextStyle = {
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.3,
  textTransform: 'uppercase' as const,
}

const itemTagTextRequiredStyle = {
  color: colors.warning,
}

const itemTagTextOptionalStyle = {
  color: colors.textMuted,
}
