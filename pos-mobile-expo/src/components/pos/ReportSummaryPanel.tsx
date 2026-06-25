import { Text, View } from 'react-native'
import type { PosConfig } from '../../types/config'
import type { PosReport } from '../../types/pos'
import { formatBranchLabel } from '../../services/config/terminalConfig'
import { roundMoney } from '../../utils/vat'
import { formatMoney, formatReceiptDate, formatVatLabel } from '../../services/printer/layouts/printLayoutUtils'
import { colors, spacing } from '../../styles/theme'

type Props = {
  kind: 'X' | 'Z'
  report: PosReport
  config: PosConfig
  seriesNo?: string
}

type SummaryRow = {
  label: string
  value: string
  emphasize?: boolean
}

type SummarySection = {
  title: string
  helper?: string
  rows: SummaryRow[]
}

function SummaryCard({ section }: { section: SummarySection }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surfaceAlt,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, marginBottom: section.helper ? 4 : spacing.sm }}>
        {section.title}
      </Text>
      {section.helper ? (
        <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: spacing.sm }}>{section.helper}</Text>
      ) : null}
      {section.rows.map((row) => (
        <View
          key={`${section.title}-${row.label}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: spacing.sm,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>{row.label}</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: row.emphasize ? 14 : 12,
              fontWeight: row.emphasize ? '800' : '600',
              textAlign: 'right',
            }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default function ReportSummaryPanel({ kind, report, config, seriesNo }: Props) {
  const reportDate = report.generated_at ? new Date(report.generated_at) : new Date()
  const vatRate = report.vat_rate ?? 0.12
  const startingBalance = report.starting_balance ?? 0
  const cashPayment = report.payment_cash ?? report.cash_in_drawer ?? 0
  const cardPayment = report.payment_card ?? 0
  const ewalletPayment = report.payment_ewallet ?? 0
  const cashToRemit = report.cash_to_remit ?? report.drawer_total ?? roundMoney(startingBalance + cashPayment)
  const referenceTotal =
    report.reference_total ?? roundMoney(startingBalance + cashPayment + cardPayment + ewalletPayment)
  const branchLabel = formatBranchLabel({
    branch_name: config.branch_name,
    branch_code: config.branch_code,
    branch: config.branch,
  })
  const resolvedSeries = seriesNo?.trim() || report.sales_series_no?.trim() || '—'

  const sections: SummarySection[] = [
    {
      title: 'Shift info',
      rows: [
        { label: 'Branch', value: branchLabel },
        { label: 'Sales series', value: resolvedSeries },
        { label: 'Cashier', value: report.cashier_name || '—' },
        { label: 'Terminal', value: config.terminal_name || report.machine_name || '—' },
        { label: 'Date / time', value: formatReceiptDate(reportDate) },
        { label: 'OR / SI range', value: `${report.start_orsi || '00000000'} – ${report.last_orsi || '00000000'}` },
      ],
    },
    {
      title: 'Sales summary',
      rows: [
        { label: 'Gross sales', value: formatMoney(report.gross_sales ?? report.total_sales) },
        { label: 'Less discount', value: formatMoney(report.discount_amount ?? 0) },
        { label: 'Net sales (before VAT)', value: formatMoney(report.net_sales_vat_excl ?? report.net_sales) },
        { label: formatVatLabel(vatRate), value: formatMoney(report.vat_amount) },
        { label: 'Total sales', value: formatMoney(report.total_sales), emphasize: true },
      ],
    },
    {
      title: 'Transactions',
      rows: [
        { label: 'Items sold', value: String(report.qty_sold) },
        { label: 'Completed sales', value: String(report.completed_count ?? report.transaction_count) },
        { label: 'Voided / cancelled', value: String(report.cancelled_count ?? 0) },
      ],
    },
    {
      title: 'Payments',
      rows: [
        { label: 'Cash', value: formatMoney(report.payment_cash ?? 0) },
        { label: 'Card', value: formatMoney(report.payment_card ?? 0) },
        { label: 'E-wallet', value: formatMoney(report.payment_ewallet ?? 0) },
        { label: 'Total collected', value: formatMoney(report.total_payments ?? report.total_sales), emphasize: true },
      ],
    },
    {
      title: 'Cash drawer',
      helper: 'Cash to remit = starting balance + cash sales',
      rows: [
        { label: 'Starting balance', value: formatMoney(startingBalance) },
        { label: 'Cash sales', value: formatMoney(cashPayment) },
        { label: 'Cash to remit', value: formatMoney(cashToRemit), emphasize: true },
        { label: 'Reference total', value: formatMoney(referenceTotal) },
      ],
    },
  ]

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: kind === 'X' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            borderWidth: 1,
            borderColor: kind === 'X' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(245, 158, 11, 0.35)',
          }}
        >
          <Text style={{ color: kind === 'X' ? colors.accent : colors.warning, fontWeight: '800', fontSize: 11 }}>
            {kind === 'X' ? 'Mid-shift snapshot' : 'End-of-shift'}
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1 }}>
          {kind === 'X'
            ? 'Does not reset POS totals.'
            : 'Closes the sales series after printing.'}
        </Text>
      </View>

      {sections.map((section) => (
        <SummaryCard key={section.title} section={section} />
      ))}
    </View>
  )
}
