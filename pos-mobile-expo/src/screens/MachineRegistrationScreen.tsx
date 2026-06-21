import { useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { lookupTerminal } from '../services/api/posApi'
import { saveConfig } from '../services/config/configStore'
import { buildConfigFromTerminal } from '../services/config/terminalConfig'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'

type Props = NativeStackScreenProps<RootStackParamList, 'MachineRegistration'>

export default function MachineRegistrationScreen({ navigation }: Props) {
  const [branchCode, setBranchCode] = useState('')
  const [terminalName, setTerminalName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSave() {
    setError('')

    const normalizedBranchCode = branchCode.trim()
    const normalizedTerminalName = terminalName.trim()

    if (!normalizedBranchCode) {
      setError('Branch code is required.')
      return
    }

    if (!normalizedTerminalName) {
      setError('Terminal name is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const terminal = await lookupTerminal(normalizedTerminalName, normalizedBranchCode)
      const config = buildConfigFromTerminal(terminal, { default_printer: '' })

      await saveConfig(config)
      navigation.replace('PrinterSelection', { config })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Registration failed.'
      setError(message)
      Alert.alert('Registration failed', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={[commonStyles.card, { width: 360, maxWidth: '92%', alignSelf: 'center' }]}>
        <Text style={commonStyles.title}>Machine Registration</Text>
        <Text style={commonStyles.subtitle}>
          Enter the branch code and terminal name assigned to this device.
        </Text>
        <Text style={commonStyles.label}>Branch code</Text>
        <TextInput
          style={commonStyles.input}
          value={branchCode}
          onChangeText={setBranchCode}
          placeholder="MAIN"
          placeholderTextColor="#64748b"
          autoCapitalize="characters"
        />
        <Text style={commonStyles.label}>Terminal name</Text>
        <TextInput
          style={commonStyles.input}
          value={terminalName}
          onChangeText={setTerminalName}
          placeholder="POS-0001"
          placeholderTextColor="#64748b"
          autoCapitalize="characters"
        />
        {error ? <Text style={commonStyles.error}>{error}</Text> : null}
        <Pressable style={commonStyles.button} onPress={() => void handleSave()} disabled={isSubmitting}>
          <Text style={commonStyles.buttonText}>{isSubmitting ? 'Validating...' : 'Save and Continue'}</Text>
        </Pressable>
      </View>
    </View>
  )
}
