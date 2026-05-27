import { Pressable, Text, View } from 'react-native'
import type { PosSummary } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'
import { formatMoney } from '../../utils/vat'

type Props = {
  seriesOptions: string[]
  activeSeriesNo: string | null
  summary: PosSummary | null
  onSelectSeries: (seriesNo: string) => void
  onCreateSeries: () => void
  onXReport: () => void
  onZReport: () => void
  onUtilities: () => void
}

export default function TopBar({
  seriesOptions,
  activeSeriesNo,
  summary,
  onSelectSeries,
  onCreateSeries,
  onXReport,
  onZReport,
  onUtilities,
}: Props) {
  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Pressable style={actionButtonStyle} onPress={onXReport}>
          <Text style={actionTextStyle}>X Report</Text>
        </Pressable>
        <Pressable style={actionButtonStyle} onPress={onZReport}>
          <Text style={actionTextStyle}>Z Report</Text>
        </Pressable>
        <Pressable style={actionButtonStyle} onPress={onCreateSeries}>
          <Text style={actionTextStyle}>New Series</Text>
        </Pressable>
        <Pressable style={actionButtonStyle} onPress={onUtilities}>
          <Text style={actionTextStyle}>Utilities</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {seriesOptions.map((series) => (
          <Pressable
            key={series}
            style={[actionButtonStyle, activeSeriesNo === series && { backgroundColor: colors.accent }]}
            onPress={() => onSelectSeries(series)}
          >
            <Text style={[actionTextStyle, activeSeriesNo === series && { color: '#0f172a' }]}>{series.split('-').slice(-1)[0]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.sm }}>
        <SummaryChip label="Total Sales" value={formatMoney(summary?.total_sales || 0)} />
        <SummaryChip label="Net Sales" value={formatMoney(summary?.net_sales || 0)} />
        <SummaryChip label="VAT" value={formatMoney(summary?.vat_amount || 0)} />
        <SummaryChip label="Qty Sold" value={String(summary?.qty_sold || 0)} />
      </View>
    </View>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </View>
  )
}

const actionButtonStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
}

const actionTextStyle = {
  color: colors.text,
  fontSize: 12,
  fontWeight: '600' as const,
}
