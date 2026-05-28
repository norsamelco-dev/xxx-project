import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useNetworkError } from '../context/NetworkErrorContext'
import { commonStyles } from '../styles/common'
import type { RootStackParamList } from '../navigation/types'
import { colors, spacing } from '../styles/theme'
import {
  getApiBaseUrlOverrides,
  isHttpUrl,
  setApiBaseUrlOverrides,
  testApiBaseUrl,
} from '../services/api/client'
import { saveApiBaseConfig } from '../services/config/apiBaseConfig'
import { loadConfig, saveConfig } from '../services/config/configStore'

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectionError'>

function normalizeInput(value: string) {
  return value.trim().replace(/\/+$/, '')
}

export default function ConnectionErrorScreen({ navigation }: Props) {
  const { details, clearConnectionError } = useNetworkError()
  const defaults = useMemo(() => getApiBaseUrlOverrides(), [])
  const [primaryUrl, setPrimaryUrl] = useState(defaults.primary)
  const [fallbackUrl, setFallbackUrl] = useState(defaults.fallback)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [validatedUrls, setValidatedUrls] = useState<{ primary: string; fallback: string } | null>(null)

  const canSave =
    validatedUrls !== null &&
    normalizeInput(primaryUrl) === validatedUrls.primary &&
    normalizeInput(fallbackUrl) === validatedUrls.fallback

  async function handleTestConnection() {
    const normalizedPrimary = normalizeInput(primaryUrl)
    const normalizedFallback = normalizeInput(fallbackUrl)

    setError('')
    setTestResult('')
    setValidatedUrls(null)

    if (!normalizedPrimary) {
      setError('Primary API URL is required.')
      return
    }

    if (!isHttpUrl(normalizedPrimary)) {
      setError('Primary API URL must be a valid http:// or https:// URL.')
      return
    }

    if (normalizedFallback && !isHttpUrl(normalizedFallback)) {
      setError('Fallback URL must be valid (http:// or https://), or leave it empty.')
      return
    }

    setIsTesting(true)
    try {
      try {
        await testApiBaseUrl(normalizedPrimary)
        setValidatedUrls({ primary: normalizedPrimary, fallback: normalizedFallback })
        setTestResult('Primary API is reachable.')
        return
      } catch {
        // continue and test fallback
      }

      if (!normalizedFallback) {
        setValidatedUrls({ primary: normalizedPrimary, fallback: '' })
        setTestResult('Primary API is required and fallback is disabled.')
        return
      }

      try {
        await testApiBaseUrl(normalizedFallback)
        setValidatedUrls({ primary: normalizedPrimary, fallback: normalizedFallback })
        setTestResult('Fallback API is reachable.')
      } catch {
        setError('Unable to reach both API URLs. Check the URLs and network, then test again.')
      }
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSave() {
    if (!canSave || !validatedUrls) {
      return
    }

    setIsSaving(true)
    setError('')

    try {
      setApiBaseUrlOverrides(validatedUrls)
      await saveApiBaseConfig(validatedUrls)
      const localConfig = await loadConfig()
      if (localConfig) {
        await saveConfig({
          ...localConfig,
          api_base_url_primary: validatedUrls.primary,
          api_base_url_fallback: validatedUrls.fallback,
        })
      }
      clearConnectionError()
      navigation.replace('Bootstrap')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save API settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={[commonStyles.card, { width: '65%', minWidth: 320, maxWidth: 700 }]}>
        <Text style={commonStyles.title}>Connection Error</Text>
        <Text style={commonStyles.subtitle}>
          The system cannot reach the API right now. Update and test API URLs to restore connection.
        </Text>
        {details?.message ? <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>Last error: {details.message}</Text> : null}

        <Text style={commonStyles.label}>Primary API URL</Text>
        <TextInput
          style={commonStyles.input}
          value={primaryUrl}
          onChangeText={setPrimaryUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://pos-api.example.com"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={commonStyles.label}>Fallback API URL</Text>
        <TextInput
          style={commonStyles.input}
          value={fallbackUrl}
          onChangeText={setFallbackUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://127.0.0.1:5000"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={commonStyles.error}>{error}</Text> : null}
        {testResult ? <Text style={{ color: colors.good, marginBottom: spacing.md }}>{testResult}</Text> : null}

        <View style={[commonStyles.row, { gap: spacing.md }]}>
          <Pressable
            style={[commonStyles.button, { flex: 1 }]}
            onPress={() => void handleTestConnection()}
            disabled={isTesting || isSaving}
          >
            <Text style={commonStyles.buttonText}>{isTesting ? 'Testing...' : 'Test Connection'}</Text>
          </Pressable>
          <Pressable
            style={[commonStyles.button, { flex: 1, opacity: canSave ? 1 : 0.55 }]}
            onPress={() => void handleSave()}
            disabled={!canSave || isSaving || isTesting}
          >
            <Text style={commonStyles.buttonText}>{isSaving ? 'Saving...' : 'Save API Settings'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
