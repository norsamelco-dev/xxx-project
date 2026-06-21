import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import DefaultPrinterModal from '../components/modals/DefaultPrinterModal'
import { loadConfig, saveConfig } from '../services/config/configStore'
import { reregisterTerminal } from '../services/config/reregisterTerminal'
import { useAuth } from '../context/AuthContext'
import { usePosSession } from '../context/PosSessionContext'
import { formatBranchLabel } from '../services/config/terminalConfig'
import type { PosConfig } from '../types/config'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'

type Props = NativeStackScreenProps<RootStackParamList, 'Utilities'>

export default function UtilitiesScreen({ navigation }: Props) {
  const { logout } = useAuth()
  const { setConfig } = usePosSession()
  const [config, setLocalConfig] = useState<PosConfig | null>(null)
  const [printerOpen, setPrinterOpen] = useState(false)

  useEffect(() => {
    void loadConfig().then(setLocalConfig)
  }, [])

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Utilities</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>
          Terminal settings are available from the File menu on the main POS screen.
        </Text>
        {config ? (
          <View style={{ marginBottom: 16 }}>
            <ConfigLine label="Terminal" value={config.terminal_name} />
            <ConfigLine label="Branch" value={formatBranchLabel(config)} />
            <ConfigLine label="Branch code" value={config.branch_code || '-'} />
            <ConfigLine label="Serial No." value={config.serial_no} />
            <ConfigLine label="MIN" value={config.min_number} />
            <ConfigLine label="PTU No." value={config.ptu_no} />
            <ConfigLine label="Printer" value={config.default_printer} />
          </View>
        ) : null}
        <Pressable
          style={commonStyles.button}
          onPress={() => {
            if (config) {
              setPrinterOpen(true)
            }
          }}
        >
          <Text style={commonStyles.buttonText}>Change Default Printer</Text>
        </Pressable>
        <Pressable
          style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]}
          onPress={() =>
            void reregisterTerminal({
              navigation,
              logout,
              onConfigCleared: () => setConfig(null),
            })
          }
        >
          <Text style={commonStyles.buttonTextLight}>Re-register Terminal</Text>
        </Pressable>
        <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
          <Text style={commonStyles.buttonTextLight}>Back</Text>
        </Pressable>
      </View>
      {config ? (
        <DefaultPrinterModal
          visible={printerOpen}
          config={config}
          onClose={() => setPrinterOpen(false)}
          onSaved={async (next) => {
            await saveConfig(next)
            setConfig(next)
            setLocalConfig(next)
            setPrinterOpen(false)
          }}
        />
      ) : null}
    </View>
  )
}

function ConfigLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ color: '#94a3b8', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#f8fafc' }}>{value}</Text>
    </View>
  )
}
