import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { deleteConfig, loadConfig } from '../services/config/configStore'
import { useAuth } from '../context/AuthContext'
import { usePosSession } from '../context/PosSessionContext'
import type { PosConfig } from '../types/config'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'

type Props = NativeStackScreenProps<RootStackParamList, 'Utilities'>

export default function UtilitiesScreen({ navigation }: Props) {
  const { logout } = useAuth()
  const { setConfig } = usePosSession()
  const [config, setLocalConfig] = useState<PosConfig | null>(null)

  useEffect(() => {
    void loadConfig().then(setLocalConfig)
  }, [])

  async function handleReregister() {
    Alert.alert('Re-register terminal', 'This deletes local config and restarts setup. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteConfig()
            setConfig(null)
            await logout()
            navigation.reset({ index: 0, routes: [{ name: 'MachineRegistration' }] })
          })()
        },
      },
    ])
  }

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Utilities</Text>
        {config ? (
          <View style={{ marginBottom: 16 }}>
            <ConfigLine label="Terminal" value={config.terminal_name} />
            <ConfigLine label="Branch" value={config.branch} />
            <ConfigLine label="Serial No." value={config.serial_no} />
            <ConfigLine label="PTU No." value={config.ptu_no} />
            <ConfigLine label="Printer" value={config.default_printer} />
          </View>
        ) : null}
        <Pressable
          style={commonStyles.button}
          onPress={() => {
            if (config) {
              navigation.navigate('PrinterSelection', { config })
            }
          }}
        >
          <Text style={commonStyles.buttonText}>Change Default Printer</Text>
        </Pressable>
        <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => void handleReregister()}>
          <Text style={commonStyles.buttonTextLight}>Re-register Terminal</Text>
        </Pressable>
        <Pressable style={[commonStyles.button, commonStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
          <Text style={commonStyles.buttonTextLight}>Back</Text>
        </Pressable>
      </View>
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
