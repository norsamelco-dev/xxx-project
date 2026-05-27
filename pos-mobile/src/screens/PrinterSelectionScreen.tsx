import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { listPrinters, type PrinterDevice } from '../services/printer/printerService'
import { loadConfig, saveConfig } from '../services/config/configStore'
import { usePosSession } from '../context/PosSessionContext'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import { colors } from '../styles/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'PrinterSelection'>

export default function PrinterSelectionScreen({ navigation, route }: Props) {
  const { setConfig } = usePosSession()
  const [printers, setPrinters] = useState<PrinterDevice[]>([])
  const [selected, setSelected] = useState(route.params.config.default_printer || '')

  useEffect(() => {
    void listPrinters().then(setPrinters)
  }, [])

  async function handleContinue() {
    const current = (await loadConfig()) || route.params.config
    const next = { ...current, default_printer: selected || printers[0]?.name || 'POS-80' }
    await saveConfig(next)
    setConfig(next)
    navigation.replace('Login')
  }

  return (
    <View style={commonStyles.screen}>
      <View style={[commonStyles.card, { flex: 1 }]}>
        <Text style={commonStyles.title}>Default Printer</Text>
        <Text style={commonStyles.subtitle}>Select the thermal printer for receipts and reports.</Text>
        <FlatList
          data={printers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={{
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
                backgroundColor: selected === item.name ? colors.accent : colors.surfaceAlt,
              }}
              onPress={() => setSelected(item.name)}
            >
              <Text style={{ color: selected === item.name ? '#0f172a' : colors.text, fontWeight: '600' }}>{item.name}</Text>
            </Pressable>
          )}
        />
        <Pressable style={commonStyles.button} onPress={() => void handleContinue()}>
          <Text style={commonStyles.buttonText}>Continue to Login</Text>
        </Pressable>
      </View>
    </View>
  )
}
