import { useEffect, useRef, useState } from 'react'
import { FlatList, Image, Modal, Pressable, Text, TextInput, View } from 'react-native'
import type { TextInput as TextInputType } from 'react-native'
import { searchProducts } from '../../services/api/posApi'
import type { ProductLookup } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'
import { formatInteger, formatMoney } from '../../utils/vat'
import { formatLongDate } from '../../utils/date'
import { getApiBaseUrl } from '../../services/api/client'

type Props = {
  visible: boolean
  onClose: () => void
  onSelect: (product: ProductLookup) => void
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

const SEARCH_INPUT_REFOCUS_MS = 5000
const ADD_COLUMN_WIDTH = 88

const headerTextStyle = { color: colors.textMuted, fontSize: 11, fontWeight: '700' as const }

function ProductSearchRow({ item, onSelect, onClose }: { item: ProductLookup; onSelect: (product: ProductLookup) => void; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md }}>
      <View style={{ flex: 2, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          {resolveImageUrl(item.product_image_path) ? (
            <Image
              source={{ uri: resolveImageUrl(item.product_image_path) || undefined }}
              style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: colors.surfaceAlt }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: colors.surfaceAlt }} />
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.barcode}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.brand} · {item.category}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.unit} · {formatMoney(item.selling_price)} · Qty {formatInteger(item.qty_total ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 2, minWidth: 0, justifyContent: 'center' }}>
        {Array.isArray(item.batches) && item.batches.length > 0 ? (
          item.batches.map((batch) => (
            <Text
              key={`${item.barcode}-${batch.batch_id}-${batch.expiry_date || 'no-expiry'}`}
              style={{
                color: batch.expiry_date ? colors.textMuted : colors.warning,
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              {batch.batch_id}: Qty {batch.qty}
              {batch.expiry_date ? ` · Exp ${formatLongDate(batch.expiry_date)}` : ' · Exp N/A'}
            </Text>
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>No batches in stock</Text>
        )}
      </View>

      <View style={{ width: ADD_COLUMN_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
        <Pressable
          style={{
            backgroundColor: colors.good,
            borderRadius: 8,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            minWidth: 72,
          }}
          onPress={() => {
            onSelect(item)
            onClose()
          }}
        >
          <Text style={{ color: '#052e16', fontWeight: '800', textAlign: 'center' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function ProductSearchModal({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductLookup[]>([])
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const searchInputRef = useRef<TextInputType>(null)

  async function handleSearch(nextQuery: string) {
    setIsSearching(true)
    setError('')

    try {
      const rows = await searchProducts(nextQuery.trim())
      setResults(rows)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.')
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (!visible) {
      return
    }
    const timeoutId = setTimeout(() => {
      void handleSearch(query)
    }, 250)
    return () => clearTimeout(timeoutId)
  }, [query, visible])

  useEffect(() => {
    if (!visible) {
      return
    }
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(focusTimer)
  }, [visible])

  useEffect(() => {
    if (!visible) {
      return
    }
    const intervalId = setInterval(() => {
      if (!isInputFocused) {
        searchInputRef.current?.focus()
      }
    }, SEARCH_INPUT_REFOCUS_MS)
    return () => clearInterval(intervalId)
  }, [visible, isInputFocused])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 900,
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' }}>
            Product Search
          </Text>
          <TextInput
            ref={searchInputRef}
            style={{ backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm }}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or barcode"
            placeholderTextColor="#64748b"
            onSubmitEditing={() => void handleSearch(query)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            autoFocus
          />
          {isSearching ? <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>Searching...</Text> : null}
          {error ? <Text style={{ color: colors.bad, marginBottom: spacing.sm }}>{error}</Text> : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              gap: spacing.md,
            }}
          >
            <Text style={[headerTextStyle, { flex: 2 }]}>Product</Text>
            <Text style={[headerTextStyle, { flex: 2 }]}>Batches</Text>
            <Text style={[headerTextStyle, { width: ADD_COLUMN_WIDTH, textAlign: 'center' }]}>Action</Text>
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={results}
            keyExtractor={(item) => String(item.product_id)}
            renderItem={({ item }) => <ProductSearchRow item={item} onSelect={onSelect} onClose={onClose} />}
          />
          <Pressable style={{ marginTop: spacing.md }} onPress={onClose}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
