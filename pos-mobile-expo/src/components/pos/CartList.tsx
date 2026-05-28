import { useEffect, useMemo, useState } from 'react'
import { FlatList, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { CartLine } from '../../types/cart'
import { colors, fonts, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'
import { getApiBaseUrl } from '../../services/api/client'

type Props = {
  lines: CartLine[]
  disabled?: boolean
  onIncrement?: (id: string) => void
  onDecrement?: (id: string) => void
  onUpdateQty?: (id: string, qty: number) => void | Promise<void>
  onQtyEditorOpenChange?: (isOpen: boolean) => void
  onRemove: (id: string) => void
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

const columns = {
  image: 44,
  batch: 72,
  barcode: 128,
  description: 160,
  brand: 100,
  unit: 48,
  qty: 56,
  price: 96,
  total: 96,
  action: 80,
} as const

const headerTextStyle = { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bold }
const cellTextStyle = { color: colors.text, fontSize: 12, fontFamily: fonts.regular }
const mutedCellTextStyle = { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular }

export default function CartList({
  lines,
  disabled = false,
  onIncrement,
  onDecrement,
  onUpdateQty,
  onQtyEditorOpenChange,
  onRemove,
}: Props) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [qtyDraft, setQtyDraft] = useState('')

  const editingLine = useMemo(
    () => (editingLineId ? lines.find((line) => line.id === editingLineId) || null : null),
    [editingLineId, lines],
  )

  useEffect(() => {
    if (editingLine) {
      setQtyDraft(String(editingLine.qty))
    } else {
      setQtyDraft('')
    }
  }, [editingLine])

  useEffect(() => {
    onQtyEditorOpenChange?.(Boolean(editingLine))
  }, [editingLine, onQtyEditorOpenChange])

  function sanitizeQtyInput(value: string) {
    return value.replace(/\D/g, '')
  }

  function openQtyEditor(line: CartLine) {
    setEditingLineId(line.id)
  }

  async function applyEditedQty() {
    if (!editingLine || !onUpdateQty) {
      setEditingLineId(null)
      return
    }
    const parsed = Math.max(1, Number(sanitizeQtyInput(qtyDraft)) || 1)
    await onUpdateQty(editingLine.id, parsed)
    setEditingLineId(null)
  }

  if (disabled) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
          Cart is disabled until an open sales series exists for this terminal and MIN number.
        </Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, fontSize: 12 }}>
          Tap New Series in File menu to start selling.
        </Text>
      </View>
    )
  }

  if (!lines.length) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <EmptyCartIcon />
        <Text style={{ color: colors.textMuted }}>Cart is empty. Scan a barcode or search products.</Text>
      </View>
    )
  }

  const tableMinWidth =
    columns.image +
    columns.batch +
    columns.barcode +
    columns.description +
    columns.brand +
    columns.unit +
    columns.qty +
    columns.price +
    columns.total +
    columns.action +
    spacing.md * 9

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
    width: '100%' as const,
    minWidth: tableMinWidth,
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, minWidth: '100%' }}>
          <View
            style={{
              ...rowStyle,
              paddingVertical: spacing.sm,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <View style={{ width: columns.image }} />
            <Text style={[headerTextStyle, { width: columns.batch }]}>Batch#</Text>
            <Text style={[headerTextStyle, { width: columns.barcode }]}>Barcode</Text>
            <Text style={[headerTextStyle, { flex: 1, minWidth: columns.description }]}>Description</Text>
            <Text style={[headerTextStyle, { width: columns.brand }]}>Brand</Text>
            <Text style={[headerTextStyle, { width: columns.unit }]}>Unit</Text>
            <Text style={[headerTextStyle, { width: columns.qty, textAlign: 'center' }]}>Qty</Text>
            <Text style={[headerTextStyle, { width: columns.price, textAlign: 'right' }]}>Price</Text>
            <Text style={[headerTextStyle, { width: columns.total, textAlign: 'right' }]}>Grand Total</Text>
            <View style={{ width: columns.action, marginLeft: 'auto', alignItems: 'flex-end' }}>
              <Text style={headerTextStyle}>Action</Text>
            </View>
          </View>
          <FlatList
            style={{ flex: 1 }}
            data={lines}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={rowStyle}>
                {resolveImageUrl(item.product_image_path) ? (
                  <Image
                    source={{ uri: resolveImageUrl(item.product_image_path) || undefined }}
                    style={{ width: columns.image, height: 44, borderRadius: 6, backgroundColor: colors.surfaceAlt }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: columns.image, height: 44, borderRadius: 6, backgroundColor: colors.surfaceAlt }} />
                )}
                <Text style={[cellTextStyle, { width: columns.batch, fontFamily: fonts.bold }]} numberOfLines={1}>
                  {item.batch_id}
                </Text>
                <Text style={[mutedCellTextStyle, { width: columns.barcode }]} numberOfLines={1}>
                  {item.barcode}
                </Text>
                <Text style={[cellTextStyle, { flex: 1, minWidth: columns.description, fontFamily: fonts.bold }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[mutedCellTextStyle, { width: columns.brand }]} numberOfLines={1}>
                  {item.brand || '—'}
                </Text>
                <Text style={[mutedCellTextStyle, { width: columns.unit }]} numberOfLines={1}>
                  {item.unit || '—'}
                </Text>
                <View style={{ width: columns.qty, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {onDecrement ? (
                    <Pressable
                      onPress={() => onDecrement(item.id)}
                      disabled={item.qty <= 1}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: item.qty <= 1 ? 0.4 : 1,
                      }}
                      accessibilityLabel="Decrease quantity"
                    >
                      <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 14 }}>−</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => openQtyEditor(item)}
                    style={{
                      minWidth: 30,
                      height: 30,
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}
                    accessibilityLabel={`Edit quantity for ${item.name}`}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        textAlign: 'center',
                        fontFamily: fonts.bold,
                        fontVariant: ['tabular-nums'],
                        fontSize: 12,
                      }}
                    >
                      {item.qty}
                    </Text>
                  </Pressable>
                  {onIncrement ? (
                    <Pressable
                      onPress={() => onIncrement(item.id)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel="Increase quantity"
                    >
                      <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 14 }}>+</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={{ color: colors.text, width: columns.price, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{formatMoney(item.price)}</Text>
                <Text style={{ color: colors.accent, width: columns.total, textAlign: 'right', fontFamily: fonts.bold, fontVariant: ['tabular-nums'] }}>{formatMoney(item.total)}</Text>
                <Pressable
                  onPress={() => onRemove(item.id)}
                  style={{
                    width: columns.action,
                    marginLeft: 'auto',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: 'flex-end',
                  }}
                  accessibilityLabel="Remove item"
                >
                  <Text style={{ color: colors.bad, fontFamily: fonts.extrabold, fontSize: 12 }}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      </ScrollView>
      <Modal visible={Boolean(editingLine)} transparent animationType="fade" onRequestClose={() => setEditingLineId(null)}>
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
              maxWidth: 320,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginBottom: spacing.xs, textAlign: 'center' }}>
              Modify Quantity
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm, textAlign: 'center' }} numberOfLines={2}>
              {editingLine?.name || 'Item'}
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceAlt,
                color: colors.text,
                borderRadius: 8,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                marginBottom: spacing.sm,
                width: '100%',
                maxWidth: 180,
                fontSize: 22,
                fontFamily: fonts.bold,
                textAlign: 'center',
              }}
              value={qtyDraft}
              onChangeText={(value) => setQtyDraft(sanitizeQtyInput(value))}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={() => void applyEditedQty()}
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
                  minWidth: 90,
                }}
                onPress={() => void applyEditedQty()}
              >
                <Text style={{ textAlign: 'center', fontFamily: fonts.bold, color: '#0f172a', fontSize: 13 }}>Apply</Text>
              </Pressable>
              <Pressable
                style={{
                  borderRadius: 8,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  minWidth: 90,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => setEditingLineId(null)}
              >
                <Text style={{ textAlign: 'center', color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function EmptyCartIcon() {
  return (
    <View
      style={{
        width: 68,
        height: 52,
        marginBottom: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 44,
          height: 26,
          borderWidth: 2,
          borderColor: colors.textMuted,
          borderRadius: 6,
          backgroundColor: colors.surfaceAlt,
          opacity: 0.75,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          width: 14,
          height: 2,
          backgroundColor: colors.textMuted,
          transform: [{ rotate: '-28deg' }],
          opacity: 0.75,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          left: 19,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textMuted,
          opacity: 0.75,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 19,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textMuted,
          opacity: 0.75,
        }}
      />
    </View>
  )
}
