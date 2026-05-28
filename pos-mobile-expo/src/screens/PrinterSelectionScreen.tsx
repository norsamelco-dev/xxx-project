import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { View } from 'react-native'
import DefaultPrinterModal from '../components/modals/DefaultPrinterModal'
import { saveConfig } from '../services/config/configStore'
import { usePosSession } from '../context/PosSessionContext'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'

type Props = NativeStackScreenProps<RootStackParamList, 'PrinterSelection'>

export default function PrinterSelectionScreen({ navigation, route }: Props) {
  const { setConfig } = usePosSession()

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <DefaultPrinterModal
        visible
        config={route.params.config}
        dismissible={false}
        saveLabel="Continue to Login"
        onSaved={async (next) => {
          await saveConfig(next)
          setConfig(next)
          navigation.replace('Login')
        }}
      />
    </View>
  )
}
