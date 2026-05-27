import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { configExists, loadConfig } from '../services/config/configStore'
import { usePosSession } from '../context/PosSessionContext'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import { colors } from '../styles/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Bootstrap'>

export default function BootstrapScreen({ navigation }: Props) {
  const { setConfig } = usePosSession()

  useEffect(() => {
    async function bootstrap() {
      const exists = await configExists()

      if (!exists) {
        navigation.replace('MachineRegistration')
        return
      }

      const saved = await loadConfig()

      if (!saved) {
        navigation.replace('MachineRegistration')
        return
      }

      setConfig(saved)

      if (!saved.default_printer) {
        navigation.replace('PrinterSelection', { config: saved })
        return
      }

      navigation.replace('Login')
    }

    void bootstrap()
  }, [navigation, setConfig])

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[commonStyles.subtitle, { marginTop: 16 }]}>Loading POS configuration...</Text>
    </View>
  )
}
