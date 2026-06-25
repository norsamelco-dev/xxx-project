import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { listTerminalsByBranchCode, lookupTerminal } from '../services/api/posApi'
import { saveConfig } from '../services/config/configStore'
import {
  assertTerminalMatchesBranch,
  buildConfigFromTerminal,
  formatBranchLabel,
} from '../services/config/terminalConfig'
import type { RootStackParamList } from '../navigation/types'
import type { TerminalListItem } from '../types/pos'
import { commonStyles } from '../styles/common'
import { colors, spacing } from '../styles/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'MachineRegistration'>

const BRANCH_LOOKUP_DEBOUNCE_MS = 400

export default function MachineRegistrationScreen({ navigation }: Props) {
  const [branchCode, setBranchCode] = useState('')
  const [branchLabel, setBranchLabel] = useState('')
  const [terminals, setTerminals] = useState<TerminalListItem[]>([])
  const [selectedTerminalName, setSelectedTerminalName] = useState('')
  const [branchLookupError, setBranchLookupError] = useState('')
  const [error, setError] = useState('')
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizedBranchCode = branchCode.trim()
  const branchResolved = Boolean(branchLabel) && !branchLookupError && !isLoadingTerminals
  const canSave = branchResolved && Boolean(selectedTerminalName) && !isSubmitting

  useEffect(() => {
    const nextBranchCode = branchCode.trim()

    if (!nextBranchCode) {
      setBranchLabel('')
      setTerminals([])
      setSelectedTerminalName('')
      setBranchLookupError('')
      setIsLoadingTerminals(false)
      return
    }

    setIsLoadingTerminals(true)
    setBranchLookupError('')
    setBranchLabel('')
    setTerminals([])
    setSelectedTerminalName('')

    const timeoutId = setTimeout(() => {
      void listTerminalsByBranchCode(nextBranchCode)
        .then((result) => {
          setBranchLabel(
            formatBranchLabel({
              branch_name: result.branch_name,
              branch_code: result.branch_code,
              branch: result.branch_name,
            }),
          )
          setTerminals(result.terminals)
        })
        .catch((loadError) => {
          const message =
            loadError instanceof Error ? loadError.message : 'Unable to load terminals for this branch.'
          setBranchLookupError(message)
          setBranchLabel('')
          setTerminals([])
        })
        .finally(() => {
          setIsLoadingTerminals(false)
        })
    }, BRANCH_LOOKUP_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [branchCode])

  async function handleSave() {
    setError('')

    if (!normalizedBranchCode) {
      setError('Branch code is required.')
      return
    }

    if (!selectedTerminalName) {
      setError('Select a terminal for this branch.')
      return
    }

    if (branchLookupError) {
      setError(branchLookupError)
      return
    }

    setIsSubmitting(true)

    try {
      const terminal = await lookupTerminal(selectedTerminalName, normalizedBranchCode)
      assertTerminalMatchesBranch(terminal, normalizedBranchCode)
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
      <View style={[commonStyles.card, { width: 420, maxWidth: '92%', alignSelf: 'center' }]}>
        <Text style={commonStyles.title}>Machine Registration</Text>
        <Text style={commonStyles.subtitle}>
          Enter the branch code, then choose a terminal registered to that branch.
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

        {isLoadingTerminals ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={commonStyles.subtitle}>Loading terminals...</Text>
          </View>
        ) : null}

        {branchLabel ? (
          <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>Branch: {branchLabel}</Text>
        ) : null}

        {branchLookupError ? <Text style={commonStyles.error}>{branchLookupError}</Text> : null}

        <Text style={commonStyles.label}>Terminal</Text>

        {!normalizedBranchCode ? (
          <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>
            Enter a branch code to load terminals.
          </Text>
        ) : null}

        {normalizedBranchCode && !isLoadingTerminals && !branchLookupError && terminals.length === 0 ? (
          <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>
            No active terminals for this branch.
          </Text>
        ) : null}

        {terminals.length > 0 ? (
          <ScrollView
            style={{
              maxHeight: 220,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            {terminals.map((terminal) => {
              const isSelected = selectedTerminalName === terminal.terminal_name

              return (
                <Pressable
                  key={terminal.terminal_name}
                  onPress={() => setSelectedTerminalName(terminal.terminal_name)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: isSelected ? '800' : '600' }}>
                    {terminal.terminal_name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {error ? <Text style={commonStyles.error}>{error}</Text> : null}

        <Pressable
          style={[commonStyles.button, !canSave ? { opacity: 0.5 } : null]}
          onPress={() => void handleSave()}
          disabled={!canSave}
        >
          <Text style={commonStyles.buttonText}>{isSubmitting ? 'Validating...' : 'Save and Continue'}</Text>
        </Pressable>
      </View>
    </View>
  )
}
