import { FlatList, Pressable, Text, View } from 'react-native'
import type { CartLine } from '../../types/cart'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  lines: CartLine[]
  onRemove: (id: string) => void
}

export default function CartList({ lines, onRemove }: Props) {
  if (!lines.length) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted }}>Cart is empty. Scan a barcode or search products.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={lines}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: 'row',
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.barcode}</Text>
          </View>
          <Text style={{ color: colors.text, width: 40, textAlign: 'center' }}>{item.qty}</Text>
          <Text style={{ color: colors.text, width: 80, textAlign: 'right' }}>{formatMoney(item.price)}</Text>
          <Text style={{ color: colors.accent, width: 90, textAlign: 'right', fontWeight: '700' }}>{formatMoney(item.total)}</Text>
          <Pressable onPress={() => onRemove(item.id)}>
            <Text style={{ color: colors.bad }}>Remove</Text>
          </Pressable>
        </View>
      )}
    />
  )
}
