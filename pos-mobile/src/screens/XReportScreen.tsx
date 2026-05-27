import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getXReport } from '../services/api/posApi'
import { printReport } from '../services/printer/printerService'
import { usePosSession } from '../context/PosSessionContext'
import type { PosReport } from '../types/pos'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import { formatMoney } from '../utils/vat'

type Props = NativeStackScreenProps<RootStackParamList, 'XReport'>

export default function XReportScreen({ navigation }: Props) {
  const { config } = usePosSession()
  const [report, setReport] = useState<PosReport | null>(null)

  useEffect(() => {
    if (!config?.terminal_name) {
      return
    }

    void getXReport(config.terminal_name).then(setReport)
  }, [config?.terminal_name])

  async function handlePrint() {
    if (!report || !config) {
      return
    }

    const body = [
      `Total Sales: ${formatMoney(report.total_sales)}`,
      `Net Sales: ${formatMoney(report.net_sales)}`,
      `VAT: ${formatMoney(report.vat_amount)}`,
      `Qty Sold: ${report.qty_sold}`,
      `Transactions: ${report.transaction_count}`,
    ].join('\n')

    await printReport('X REPORT', body, config.default_printer)
  }

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>X Report</Text>
        <Text style={commonStyles.subtitle}>Mid-day summary (does not reset sales).</Text>
        {report ? (
          <>
            <ReportLine label="Total Sales" value={formatMoney(report.total_sales)} />
            <ReportLine label="Net Sales" value={formatMoney(report.net_sales)} />
            <ReportLine label="VAT Amount" value={formatMoney(report.vat_amount)} />
            <ReportLine label="Qty Sold" value={String(report.qty_sold)} />
            <ReportLine label="Transactions" value={String(report.transaction_count)} />
          </>
        ) : (
          <Text style={commonStyles.subtitle}>Loading report...</Text>
        )}
        <Pressable style={commonStyles.button} onPress={() => void handlePrint()}>
          <Text style={commonStyles.buttonText}>Print X Report</Text>
        </Pressable>
        <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
          <Text style={commonStyles.buttonTextLight}>Back</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ReportLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: '#94a3b8' }}>{label}</Text>
      <Text style={{ color: '#f8fafc', fontWeight: '700' }}>{value}</Text>
    </View>
  )
}
