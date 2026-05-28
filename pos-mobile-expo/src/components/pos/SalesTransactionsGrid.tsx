import type { ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { SalesItemRow, SalesTransactionRow } from '../../types/sales'
import { colors, fonts } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

export type TransactionStatus = 'ACTIVE' | 'VOIDED' | 'PARTIAL'

export const gridTheme = {
  pageBg: colors.bg,
  surface: colors.surface,
  surfaceAlt: colors.surfaceAlt,
  border: colors.border,
  text: colors.text,
  textMuted: colors.textMuted,
  accent: colors.accent,
  good: colors.good,
  goodTint: '#052e16',
  bad: colors.bad,
  badTint: '#450a0a',
  warning: colors.warning,
  warningTint: '#422006',
  partialTint: '#2e1065',
  partialText: '#c4b5fd',
  rowHover: '#273449',
  nestedBg: '#162032',
}

type ColumnAlign = 'left' | 'right' | 'center'

type GridColumn = {
  key: string
  label: string
  width?: number
  flex?: number
  minWidth?: number
  align?: ColumnAlign
}

const TXN_COLUMNS: GridColumn[] = [
  { key: 'expand', label: '', width: 44 },
  { key: 'orsi', label: 'OR/SI', flex: 1, minWidth: 96 },
  { key: 'date', label: 'Date', flex: 1.35, minWidth: 148 },
  { key: 'payment', label: 'Payment', flex: 1.65, minWidth: 120 },
  { key: 'items', label: 'Items', flex: 0.55, minWidth: 52, align: 'center' },
  { key: 'total', label: 'Grand total', flex: 1, minWidth: 96, align: 'right' },
  { key: 'status', label: 'Status', flex: 0.85, minWidth: 88 },
  { key: 'actions', label: 'Actions', flex: 1.35, minWidth: 200, align: 'right' },
]

const ITEM_COLUMNS: GridColumn[] = [
  { key: 'lineId', label: 'Line', width: 72 },
  { key: 'description', label: 'Description', flex: 2.2, minWidth: 140 },
  { key: 'barcode', label: 'Barcode', flex: 1.1, minWidth: 96 },
  { key: 'batch', label: 'Batch', flex: 0.75, minWidth: 72 },
  { key: 'qty', label: 'Qty', flex: 0.45, minWidth: 44, align: 'center' },
  { key: 'price', label: 'Price', flex: 0.85, minWidth: 72, align: 'right' },
  { key: 'total', label: 'Total', flex: 0.9, minWidth: 80, align: 'right' },
  { key: 'status', label: 'Status', flex: 0.7, minWidth: 72 },
]

function columnLayoutStyle(column: GridColumn) {
  if (column.width != null) {
    return { width: column.width, flexShrink: 0 as const }
  }

  return {
    flex: column.flex ?? 1,
    minWidth: column.minWidth ?? 0,
    flexShrink: 1 as const,
  }
}

type Props = {
  transactions: SalesTransactionRow[]
  expandedOrsis: number[]
  itemsByOrsi: Record<number, SalesItemRow[]>
  loadingItems: Record<number, boolean>
  seriesOpen: boolean
  busyOrsi: number | null
  isVoidSubmitting: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  getStatus: (transaction: SalesTransactionRow, items: SalesItemRow[]) => TransactionStatus
  onToggleExpand: (orsi: number) => void
  onOpen: (orsi: number) => void
  onCancelOrsi: (orsi: number) => void
  onReprint: (orsi: number) => void
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatOrsi(value: number | string | null | undefined) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return '-'
  }
  return String(numeric).padStart(8, '0')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

function isVoided(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'Y' || normalized === 'YES' || normalized === '1'
}

function StatusPill({ status }: { status: TransactionStatus }) {
  const styles =
    status === 'VOIDED'
      ? { bg: gridTheme.badTint, text: gridTheme.bad, label: 'VOIDED' }
      : status === 'PARTIAL'
        ? { bg: gridTheme.partialTint, text: gridTheme.partialText, label: 'PARTIAL' }
        : { bg: gridTheme.goodTint, text: gridTheme.good, label: 'ACTIVE' }

  return (
    <View style={{ backgroundColor: styles.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: styles.text, fontSize: 11, fontFamily: fonts.bold }}>{styles.label}</Text>
    </View>
  )
}

function OrsiBadge({ value }: { value: number | string | null | undefined }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#0f1f35',
        borderWidth: 1,
        borderColor: '#2b4467',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: gridTheme.accent, fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.6 }} numberOfLines={1}>
        {formatOrsi(value)}
      </Text>
    </View>
  )
}

function GridHeaderCell({ column }: { column: GridColumn }) {
  return (
    <View style={columnLayoutStyle(column)}>
      <Text
        style={{
          color: gridTheme.textMuted,
          fontSize: 11,
          fontFamily: fonts.bold,
          textTransform: 'uppercase',
          textAlign: column.align || 'left',
        }}
        numberOfLines={1}
      >
        {column.label}
      </Text>
    </View>
  )
}

function GridCell({
  column,
  children,
  align,
}: {
  column: GridColumn
  children: ReactNode
  align?: ColumnAlign
}) {
  const textAlign = align || column.align || 'left'

  return (
    <View style={[columnLayoutStyle(column), { justifyContent: 'center' }]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={{ color: gridTheme.text, fontSize: 12, textAlign }} numberOfLines={2}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

function IconAction({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string
  tone: 'danger' | 'primary' | 'muted'
  disabled?: boolean
  onPress: () => void
}) {
  const color = tone === 'danger' ? gridTheme.bad : tone === 'primary' ? gridTheme.accent : gridTheme.textMuted

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        { paddingHorizontal: 8, paddingVertical: 4, opacity: disabled ? 0.45 : 1 },
        Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as const) : null,
      ]}
    >
      <Text style={{ color, fontFamily: fonts.bold, fontSize: 12 }}>{label}</Text>
    </Pressable>
  )
}

export default function SalesTransactionsGrid({
  transactions,
  expandedOrsis,
  itemsByOrsi,
  loadingItems,
  seriesOpen,
  busyOrsi,
  isVoidSubmitting,
  searchQuery,
  onSearchQueryChange,
  getStatus,
  onToggleExpand,
  onOpen,
  onCancelOrsi,
  onReprint,
}: Props) {
  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredTransactions = transactions.filter((transaction) => {
    if (!normalizedSearch) {
      return true
    }

    const haystack = [
      formatOrsi(transaction.ORSI),
      String(transaction.ORSI),
      transaction.payment_method,
      transaction.payment_ref_no,
      transaction.username,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%' as const,
    alignSelf: 'stretch' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: gridTheme.border,
    gap: 10,
  }

  const nestedRowStyle = {
    ...rowStyle,
    paddingVertical: 12,
    minHeight: 48,
    gap: 8,
    backgroundColor: gridTheme.surface,
  }

  return (
    <View
      style={{
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: gridTheme.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: gridTheme.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: gridTheme.border,
          backgroundColor: gridTheme.surfaceAlt,
        }}
      >
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search OR/SI, payment, or cashier..."
          placeholderTextColor={gridTheme.textMuted}
          style={{
            flex: 1,
            backgroundColor: gridTheme.surface,
            borderWidth: 1,
            borderColor: gridTheme.border,
            borderRadius: 8,
            color: gridTheme.text,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'web' ? 10 : 12,
            fontSize: 13,
          }}
        />
        <Text style={{ color: gridTheme.textMuted, fontSize: 12, flexShrink: 0 }}>
          {filteredTransactions.length} transaction(s)
        </Text>
      </View>

      <View style={{ width: '100%', alignSelf: 'stretch' }}>
        <View style={[rowStyle, { backgroundColor: gridTheme.surfaceAlt, paddingVertical: 12, minHeight: 44 }]}>
          {TXN_COLUMNS.map((column) => (
            <GridHeaderCell key={column.key} column={column} />
          ))}
        </View>

          {filteredTransactions.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: gridTheme.textMuted }}>No transactions match your search.</Text>
            </View>
          ) : (
            filteredTransactions.map((transaction) => {
              const orsi = transaction.ORSI
              const expanded = expandedOrsis.includes(orsi)
              const items = itemsByOrsi[orsi] || []
              const status = getStatus(transaction, items)
              const txnBusy = busyOrsi === orsi
              const voidDisabled = !seriesOpen || status === 'VOIDED' || txnBusy || isVoidSubmitting
              const lineCount = items.length || toNumber(transaction.line_item_count)

              return (
                <View key={`txn-${orsi}`}>
                  <View style={[rowStyle, expanded && { backgroundColor: gridTheme.surfaceAlt }]}>
                    <View style={columnLayoutStyle(TXN_COLUMNS[0])}>
                      <Pressable
                        onPress={() => onToggleExpand(orsi)}
                        style={[
                          { alignItems: 'center', justifyContent: 'center', minHeight: 28 },
                          Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null,
                        ]}
                      >
                        <Text style={{ color: gridTheme.textMuted, fontFamily: fonts.bold, fontSize: 14 }}>
                          {expanded ? '▼' : '▶'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={columnLayoutStyle(TXN_COLUMNS[1])}>
                      <OrsiBadge value={orsi} />
                    </View>
                    <GridCell column={TXN_COLUMNS[2]}>{formatDateTime(transaction.created_at)}</GridCell>
                    <GridCell column={TXN_COLUMNS[3]}>{transaction.payment_method || '-'}</GridCell>
                    <GridCell column={TXN_COLUMNS[4]} align="center">
                      <Text style={{ color: gridTheme.textMuted, fontSize: 12, textAlign: 'center', width: '100%' }}>
                        {lineCount}
                      </Text>
                    </GridCell>
                    <View style={columnLayoutStyle(TXN_COLUMNS[5])}>
                      <Text
                        style={{
                          color: gridTheme.text,
                          fontFamily: fonts.bold,
                          fontSize: 13,
                          textAlign: 'right',
                          width: '100%',
                        }}
                        numberOfLines={1}
                      >
                        {formatMoney(toNumber(transaction.sales_grandtotal))}
                      </Text>
                    </View>
                    <View style={columnLayoutStyle(TXN_COLUMNS[6])}>
                      <StatusPill status={status} />
                    </View>
                    <View
                      style={[
                        columnLayoutStyle(TXN_COLUMNS[7]),
                        {
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 2,
                        },
                      ]}
                    >
                      <IconAction
                        label="Open"
                        tone="muted"
                        disabled={txnBusy || isVoidSubmitting}
                        onPress={() => onOpen(orsi)}
                      />
                      <IconAction
                        label="Reprint"
                        tone="primary"
                        disabled={txnBusy || isVoidSubmitting}
                        onPress={() => onReprint(orsi)}
                      />
                      <IconAction
                        label="Cancel"
                        tone="danger"
                        disabled={voidDisabled}
                        onPress={() => onCancelOrsi(orsi)}
                      />
                    </View>
                  </View>

                  {expanded ? (
                    <View
                      style={{
                        backgroundColor: gridTheme.nestedBg,
                        borderBottomWidth: 1,
                        borderBottomColor: gridTheme.border,
                        borderLeftWidth: 3,
                        borderLeftColor: gridTheme.accent,
                        marginLeft: 12,
                        paddingBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: gridTheme.textMuted,
                          fontSize: 11,
                          fontFamily: fonts.bold,
                          textTransform: 'uppercase',
                          paddingHorizontal: 16,
                          paddingTop: 10,
                          paddingBottom: 4,
                        }}
                      >
                        Line items
                      </Text>

                      {transaction.VOID_REASON && transaction.VOID_REASON !== 'N/A' ? (
                        <Text
                          style={{
                            color: gridTheme.textMuted,
                            fontSize: 12,
                            paddingHorizontal: 16,
                            paddingBottom: 4,
                          }}
                        >
                          Void reason: {transaction.VOID_REASON}
                        </Text>
                      ) : null}

                      {loadingItems[orsi] ? (
                        <ActivityIndicator color={gridTheme.accent} style={{ margin: 16 }} />
                      ) : items.length === 0 ? (
                        <Text style={{ color: gridTheme.textMuted, fontSize: 12, padding: 16 }}>No line items.</Text>
                      ) : (
                        <View style={{ paddingHorizontal: 12, paddingTop: 8, width: '100%' }}>
                          <View
                            style={[
                              rowStyle,
                              {
                                backgroundColor: gridTheme.surfaceAlt,
                                paddingVertical: 10,
                                minHeight: 40,
                                paddingHorizontal: 12,
                              },
                            ]}
                          >
                            {ITEM_COLUMNS.map((column) => (
                              <GridHeaderCell key={column.key} column={column} />
                            ))}
                          </View>

                          {items.map((item) => {
                            const itemVoided = isVoided(item.VOIDED)

                            return (
                              <View
                                key={item.ID}
                                style={[nestedRowStyle, { opacity: itemVoided ? 0.72 : 1, paddingHorizontal: 12 }]}
                              >
                                <View style={columnLayoutStyle(ITEM_COLUMNS[0])}>
                                  <Text style={{ color: gridTheme.textMuted, fontSize: 12 }}>#{item.ID}</Text>
                                </View>
                                <View style={columnLayoutStyle(ITEM_COLUMNS[1])}>
                                  <Text style={{ color: gridTheme.text, fontSize: 12, fontFamily: fonts.semibold }} numberOfLines={2}>
                                    {item.DESCRIPTION || 'Item'}
                                  </Text>
                                </View>
                                <GridCell column={ITEM_COLUMNS[2]}>
                                  <Text style={{ color: gridTheme.textMuted, fontSize: 11 }} numberOfLines={1}>
                                    {item.BARCODE || '-'}
                                  </Text>
                                </GridCell>
                                <GridCell column={ITEM_COLUMNS[3]}>
                                  <Text style={{ color: gridTheme.textMuted, fontSize: 11 }} numberOfLines={1}>
                                    {item.BATCHID || '-'}
                                  </Text>
                                </GridCell>
                                <GridCell column={ITEM_COLUMNS[4]} align="center">
                                  <Text style={{ color: gridTheme.text, fontSize: 12, textAlign: 'center', width: '100%' }}>
                                    {toNumber(item.QTY)}
                                  </Text>
                                </GridCell>
                                <View style={columnLayoutStyle(ITEM_COLUMNS[5])}>
                                  <Text style={{ color: gridTheme.text, fontSize: 12, textAlign: 'right', width: '100%' }}>
                                    {formatMoney(toNumber(item.PRICE))}
                                  </Text>
                                </View>
                                <View style={columnLayoutStyle(ITEM_COLUMNS[6])}>
                                  <Text
                                    style={{
                                      color: gridTheme.text,
                                      fontFamily: fonts.bold,
                                      fontSize: 12,
                                      textAlign: 'right',
                                      width: '100%',
                                    }}
                                  >
                                    {formatMoney(toNumber(item.TOTAL))}
                                  </Text>
                                </View>
                                <View style={columnLayoutStyle(ITEM_COLUMNS[7])}>
                                  <Text
                                    style={{
                                      color: itemVoided ? gridTheme.bad : gridTheme.good,
                                      fontSize: 11,
                                      fontFamily: fonts.bold,
                                    }}
                                  >
                                    {itemVoided ? 'VOIDED' : 'ACTIVE'}
                                  </Text>
                                </View>
                              </View>
                            )
                          })}
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              )
            })
          )}
      </View>
    </View>
  )
}
