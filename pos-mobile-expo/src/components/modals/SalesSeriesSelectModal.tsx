import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'
import { formatInteger, formatMoney } from '../../utils/vat'
import type { PosSummary, SeriesCloseRequirements } from '../../types/pos'

type Props = {
  visible: boolean
  seriesOptions: string[]
  activeSeriesNo: string | null
  closeRequirementsBySeries: Record<string, SeriesCloseRequirements>
  summaryBySeries: Record<string, PosSummary>
  isLoadingCloseRequirements: boolean
  isLoadingSeriesSummaries: boolean
  closingSeriesNo: string | null
  isClosingSeries?: boolean
  onSelectSeries: (seriesNo: string) => void
  onCloseSeries: (seriesNo: string) => void
  onDismiss: () => void
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: '45%' }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{value}</Text>
    </View>
  )
}

function ReportStatusChip({ label, printed }: { label: string; printed: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: printed ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
        borderWidth: 1,
        borderColor: printed ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)',
      }}
    >
      <Text style={{ color: printed ? colors.good : colors.warning, fontSize: 11, fontWeight: '800' }}>
        {label}
      </Text>
      <Text style={{ color: printed ? colors.good : colors.warning, fontSize: 11, fontWeight: '700' }}>
        {printed ? 'Printed' : 'Required'}
      </Text>
    </View>
  )
}

export default function SalesSeriesSelectModal({
  visible,
  seriesOptions,
  activeSeriesNo,
  closeRequirementsBySeries,
  summaryBySeries,
  isLoadingCloseRequirements,
  isLoadingSeriesSummaries,
  closingSeriesNo,
  isClosingSeries = false,
  onSelectSeries,
  onCloseSeries,
  onDismiss,
}: Props) {
  const isLoading = isLoadingCloseRequirements || isLoadingSeriesSummaries

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: spacing.lg,
          alignItems: 'center',
        }}
        onPress={onDismiss}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 520,
            maxHeight: '80%',
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.xs }}>
            Select Sales Series
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: spacing.md }}>
            Choose the active series for this terminal. Closing a series ends your shift and requires a new series before
            selling again.
          </Text>

          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: colors.warning,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
              Print X and Z reports from the Report menu before closing a series.
            </Text>
          </View>

          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Loading series details...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {seriesOptions.map((series) => {
                const isActive = activeSeriesNo === series
                const isClosingRow = closingSeriesNo === series || (isClosingSeries && isActive)
                const requirements = closeRequirementsBySeries[series]
                const isMissingReports = Boolean(requirements) && !requirements.can_close
                const cannotClose = isClosingRow || isMissingReports
                const summary = summaryBySeries[series]

                return (
                  <View
                    key={series}
                    style={{
                      borderRadius: 12,
                      borderWidth: isActive ? 2 : 1,
                      borderColor: isActive ? colors.accent : colors.border,
                      backgroundColor: colors.surfaceAlt,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing.sm,
                        marginBottom: spacing.sm,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, flex: 1 }} numberOfLines={1}>
                        {series}
                      </Text>
                      {isActive ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            backgroundColor: colors.accent,
                          }}
                        >
                          <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800' }}>Current</Text>
                        </View>
                      ) : null}
                    </View>

                    {summary ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: spacing.md,
                          marginBottom: spacing.md,
                          paddingTop: spacing.xs,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        }}
                      >
                        <StatCell label="Total sales" value={formatMoney(summary.total_sales)} />
                        <StatCell label="Net sales" value={formatMoney(summary.net_sales)} />
                        <StatCell label="VAT" value={formatMoney(summary.vat_amount)} />
                        <StatCell label="Qty sold" value={formatInteger(summary.qty_sold)} />
                      </View>
                    ) : null}

                    {requirements ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                        <ReportStatusChip label="X Report" printed={requirements.x_report_printed} />
                        <ReportStatusChip label="Z Report" printed={requirements.z_report_printed} />
                      </View>
                    ) : null}

                    {isMissingReports && requirements ? (
                      <Text style={{ color: colors.warning, fontSize: 11, lineHeight: 16, marginBottom: spacing.sm }}>
                        Print {requirements.missing_reports.join(' and ')} report
                        {requirements.missing_reports.length > 1 ? 's' : ''} before closing.
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {!isActive ? (
                        <Pressable
                          style={{
                            flex: 1,
                            backgroundColor: colors.accent,
                            borderRadius: 8,
                            paddingVertical: spacing.sm,
                            paddingHorizontal: spacing.md,
                            alignItems: 'center',
                          }}
                          onPress={() => onSelectSeries(series)}
                        >
                          <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 13 }}>Use this series</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={{
                          flex: isActive ? 1 : undefined,
                          minWidth: isActive ? undefined : 120,
                          backgroundColor: 'transparent',
                          borderRadius: 8,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: cannotClose ? colors.border : colors.bad,
                          opacity: cannotClose ? 0.5 : 1,
                        }}
                        onPress={() => onCloseSeries(series)}
                        disabled={cannotClose}
                      >
                        <Text style={{ color: cannotClose ? colors.textMuted : colors.bad, fontWeight: '800', fontSize: 13 }}>
                          {isClosingRow ? 'Closing...' : 'Close series'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          )}

          <View style={{ marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: 8,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              onPress={onDismiss}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Dismiss</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
