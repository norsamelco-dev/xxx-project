import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TextInput, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/context/AuthContext'
import { PosSessionProvider } from './src/context/PosSessionContext'
import { CartProvider } from './src/context/CartContext'
import { ToastProvider } from './src/context/ToastContext'
import { NetworkErrorProvider } from './src/context/NetworkErrorContext'
import { loadApiBaseConfig } from './src/services/config/apiBaseConfig'
import { setApiBaseUrlOverrides } from './src/services/api/client'
import { loadConfig } from './src/services/config/configStore'
import { colors, fonts } from './src/styles/theme'

let defaultsApplied = false

function applyDefaultFontFamily() {
  if (defaultsApplied) {
    return
  }

  const existingTextStyle = Text.defaultProps?.style
  Text.defaultProps = {
    ...(Text.defaultProps || {}),
    style: [{ fontFamily: fonts.regular }, existingTextStyle].filter(Boolean),
  }

  const existingInputStyle = TextInput.defaultProps?.style
  TextInput.defaultProps = {
    ...(TextInput.defaultProps || {}),
    style: [{ fontFamily: fonts.regular }, existingInputStyle].filter(Boolean),
  }

  defaultsApplied = true
}

export default function App() {
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  })

  useEffect(() => {
    if (fontsLoaded) {
      applyDefaultFontFamily()
    }
  }, [fontsLoaded])

  useEffect(() => {
    async function bootstrapApiBaseConfig() {
      try {
        const localConfig = await loadConfig()
        if (localConfig?.api_base_url_primary) {
          setApiBaseUrlOverrides({
            primary: localConfig.api_base_url_primary,
            fallback: localConfig.api_base_url_fallback || '',
          })
          return
        }

        const saved = await loadApiBaseConfig()
        if (saved?.primary) {
          setApiBaseUrlOverrides({
            primary: saved.primary,
            fallback: saved.fallback || '',
          })
        }
      } finally {
        setIsBootstrapped(true)
      }
    }

    void bootstrapApiBaseConfig()
  }, [])

  if (!isBootstrapped || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <NetworkErrorProvider>
        <AuthProvider>
          <PosSessionProvider>
            <ToastProvider>
              <CartProvider>
                <RootNavigator />
              </CartProvider>
            </ToastProvider>
          </PosSessionProvider>
        </AuthProvider>
      </NetworkErrorProvider>
    </SafeAreaProvider>
  )
}
