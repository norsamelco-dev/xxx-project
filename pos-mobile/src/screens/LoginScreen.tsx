import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { loadConfig } from '../services/config/configStore'
import { lookupTerminal } from '../services/api/posApi'
import { usePosSession } from '../context/PosSessionContext'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const { login, isLoading } = useAuth()
  const { setConfig, setCurrentOrn } = usePosSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')

    try {
      await login(username, password)
      const config = await loadConfig()

      if (config) {
        setConfig(config)
        const terminal = await lookupTerminal(config.terminal_name)
        setCurrentOrn(terminal.current_or)
      }
      navigation.replace('MainPos')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.')
    }
  }

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center' }]}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Cashier Sign In</Text>
        <Text style={commonStyles.subtitle}>Use your existing POS credentials.</Text>
        <Text style={commonStyles.label}>Username</Text>
        <TextInput style={commonStyles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholderTextColor="#64748b" />
        <Text style={commonStyles.label}>Password</Text>
        <TextInput
          style={commonStyles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#64748b"
        />
        {error ? <Text style={commonStyles.error}>{error}</Text> : null}
        <Pressable style={commonStyles.button} onPress={() => void handleSubmit()} disabled={isLoading}>
          <Text style={commonStyles.buttonText}>{isLoading ? 'Signing in...' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </View>
  )
}
