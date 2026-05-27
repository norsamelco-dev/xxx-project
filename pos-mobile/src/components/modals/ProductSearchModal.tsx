import { useState } from 'react'
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { searchProducts } from '../../services/api/posApi'
import type { ProductLookup } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  visible: boolean
  onClose: () => void
  onSelect: (product: ProductLookup) => void
}

export default function ProductSearchModal({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductLookup[]>([])
  const [error, setError] = useState('')

  async function handleSearch() {
    setError('')

    try {
      const rows = await searchProducts(query)
      setResults(rows)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, maxHeight: '80%' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>Product Search</Text>
          <TextInput
            style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or barcode"
            placeholderTextColor="#64748b"
            onSubmitEditing={() => void handleSearch()}
          />
          <Pressable style={{ backgroundColor: colors.accent, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md }} onPress={() => void handleSearch()}>
            <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>Search</Text>
          </Pressable>
          {error ? <Text style={{ color: colors.bad, marginBottom: spacing.sm }}>{error}</Text> : null}
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.product_id)}
            renderItem={({ item }) => (
              <Pressable
                style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => {
                  onSelect(item)
                  onClose()
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.textMuted }}>{item.barcode} · {formatMoney(item.selling_price)}</Text>
              </Pressable>
            )}
          />
          <Pressable style={{ marginTop: spacing.md }} onPress={onClose}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
