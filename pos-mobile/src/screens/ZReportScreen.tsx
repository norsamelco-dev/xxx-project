import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { getXReport, runZReport } from '../services/api/posApi'
import { printReport } from '../services/printer/printerService'
import { usePosSession } from '../context/PosSessionContext'
import type { PosReport } from '../types/pos'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import { formatMoney } from '../utils/vat'

type Props = NativeStackScreenProps<RootStackParamList, 'ZReport'>

export default function ZReportScreen({ navigation }: Props) {
  const { config, refreshSeries } = usePosSession()
  const [report, setReport] = useState<PosReport | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!config?.terminal_name) {
      return
    }

    void getXReport(config.terminal_name).then(setReport).catch(() => undefined)
  }, [config?.terminal_name])

  async function handleConfirmZ() {
    if (!config) {
      return
    }

    Alert.alert('Confirm Z Report', 'This will lock open sales series for the day. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsRunning(true)

            try {
              const data = await runZReport(config.terminal_name)
              setReport(data)
              const body = [
                `Total Sales: ${formatMoney(data.total_sales)}`,
                `Net Sales: ${formatMoney(data.net_sales)}`,
                `VAT: ${formatMoney(data.vat_amount)}`,
                `Qty Sold: ${data.qty_sold}`,
                `Transactions: ${data.transaction_count}`,
              ].join('\n')
              await printReport('Z REPORT', body, config.default_printer)
              await refreshSeries()
              Alert.alert('Z Report complete', 'Open sales series have been locked.')
            } catch (error) {
              Alert.alert('Z Report failed', error instanceof Error ? error.message : 'Failed.')
            } finally {
              setIsRunning(false)
            }
          })()
        },
      },
    ])
  }

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Z Report</Text>
        <Text style={commonStyles.subtitle}>End-of-day report. Locks open series after confirmation.</Text>
        {report ? (
          <>
            <ReportLine label="Total Sales" value={formatMoney(report.total_sales)} />
            <ReportLine label="Net Sales" value={formatMoney(report.net_sales)} />
            <ReportLine label="VAT Amount" value={formatMoney(report.vat_amount)} />
            <ReportLine label="Qty Sold" value={String(report.qty_sold)} />
            <ReportLine label="Transactions" value={String(report.transaction_count)} />
          </>
        ) : null}
        <Pressable style={commonStyles.button} onPress={() => void handleConfirmZ()} disabled={isRunning}>
          <Text style={commonStyles.buttonText}>{isRunning ? 'Processing...' : 'Run and Print Z Report'}</Text>
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
