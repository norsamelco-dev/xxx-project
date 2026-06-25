import { useEffect, useRef, useState } from 'react'
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import ConfirmModal from '../components/modals/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import { loadConfig, saveConfig } from '../services/config/configStore'
import { mergeTerminalIntoConfig, resolveBranchCode, formatBranchLabel } from '../services/config/terminalConfig'
import { performTerminalReregister } from '../services/config/reregisterTerminal'
import { getPosReceiptContextPublic, lookupTerminal } from '../services/api/posApi'
import { usePosSession } from '../context/PosSessionContext'
import type { RootStackParamList } from '../navigation/types'
import { commonStyles } from '../styles/common'
import {
  getApiBaseUrl,
  getApiBaseUrlOverrides,
  isHttpUrl,
  setApiBaseUrlOverrides,
  testApiBaseUrl,
} from '../services/api/client'
import { saveApiBaseConfig } from '../services/config/apiBaseConfig'
import { colors, spacing } from '../styles/theme'

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>

const LOGO_TAP_TARGET = 5
const LOGO_TAP_RESET_MS = 2000

export default function LoginScreen({ navigation }: Props) {
  const { login, logout, isLoading } = useAuth()
  const { setConfig, setCurrentOrn } = usePosSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [registeredBranchLabel, setRegisteredBranchLabel] = useState('')
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [showApiModal, setShowApiModal] = useState(false)
  const [apiSettingsError, setApiSettingsError] = useState('')
  const [isSavingApiSettings, setIsSavingApiSettings] = useState(false)
  const [isTestingPrimary, setIsTestingPrimary] = useState(false)
  const [isTestingFallback, setIsTestingFallback] = useState(false)
  const [primaryTestMessage, setPrimaryTestMessage] = useState('')
  const [fallbackTestMessage, setFallbackTestMessage] = useState('')
  const [primaryTestOk, setPrimaryTestOk] = useState<boolean | null>(null)
  const [fallbackTestOk, setFallbackTestOk] = useState<boolean | null>(null)
  const [primaryApiUrl, setPrimaryApiUrl] = useState(getApiBaseUrlOverrides().primary)
  const [fallbackApiUrl, setFallbackApiUrl] = useState(getApiBaseUrlOverrides().fallback)
  const [showReregisterModal, setShowReregisterModal] = useState(false)
  const [isReregistering, setIsReregistering] = useState(false)
  const logoTapCountRef = useRef(0)
  const logoTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDesktop = typeof window !== 'undefined' && window.desktop?.isElectron === true

  useEffect(() => {
    let isMounted = true

    async function loadBranchBranding() {
      try {
        const config = await loadConfig()
        if (isMounted && config) {
          setRegisteredBranchLabel(formatBranchLabel(config))
        }

        const heading = await getPosReceiptContextPublic(resolveBranchCode(config))
        const logoPath = heading?.business_logo_path || heading?.developer_logo_path || null

        if (!logoPath) {
          return
        }

        const baseUrl = getApiBaseUrl()
        const resolved = /^https?:\/\//i.test(logoPath) ? logoPath : `${baseUrl}${logoPath}`

        if (isMounted) {
          setLogoUri(resolved)
        }
      } catch {
        // Logo is optional; ignore failures so login remains usable.
      }
    }

    void loadBranchBranding()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (logoTapTimeoutRef.current) {
        clearTimeout(logoTapTimeoutRef.current)
      }
    }
  }, [])

  function handleLogoPress() {
    if (logoTapTimeoutRef.current) {
      clearTimeout(logoTapTimeoutRef.current)
    }

    logoTapCountRef.current += 1

    if (logoTapCountRef.current >= LOGO_TAP_TARGET) {
      logoTapCountRef.current = 0
      setShowReregisterModal(true)
      return
    }

    logoTapTimeoutRef.current = setTimeout(() => {
      logoTapCountRef.current = 0
      logoTapTimeoutRef.current = null
    }, LOGO_TAP_RESET_MS)
  }

  async function handleConfirmReregister() {
    if (isReregistering) {
      return
    }

    setIsReregistering(true)

    try {
      await performTerminalReregister({
        navigation,
        logout,
        onConfigCleared: () => setConfig(null),
      })
      setShowReregisterModal(false)
    } finally {
      setIsReregistering(false)
    }
  }

  function handleOpenApiModal() {
    const current = getApiBaseUrlOverrides()
    setPrimaryApiUrl(current.primary)
    setFallbackApiUrl(current.fallback)
    setApiSettingsError('')
    setPrimaryTestMessage('')
    setFallbackTestMessage('')
    setPrimaryTestOk(null)
    setFallbackTestOk(null)
    setShowApiModal(true)
  }

  async function handleTestPrimary() {
    const normalizedPrimary = primaryApiUrl.trim().replace(/\/+$/, '')
    setPrimaryTestMessage('')
    setPrimaryTestOk(null)

    if (!normalizedPrimary) {
      setPrimaryTestMessage('Primary base URL is required.')
      setPrimaryTestOk(false)
      return
    }

    if (!isHttpUrl(normalizedPrimary)) {
      setPrimaryTestMessage('Enter a valid http:// or https:// URL.')
      setPrimaryTestOk(false)
      return
    }

    setIsTestingPrimary(true)
    try {
      await testApiBaseUrl(normalizedPrimary)
      setPrimaryTestMessage('Primary URL is reachable.')
      setPrimaryTestOk(true)
    } catch (error) {
      setPrimaryTestMessage(error instanceof Error ? error.message : 'Unable to reach primary URL.')
      setPrimaryTestOk(false)
    } finally {
      setIsTestingPrimary(false)
    }
  }

  async function handleTestFallback() {
    const normalizedFallback = fallbackApiUrl.trim().replace(/\/+$/, '')
    setFallbackTestMessage('')
    setFallbackTestOk(null)

    if (!normalizedFallback) {
      setFallbackTestMessage('Fallback is empty (disabled).')
      setFallbackTestOk(true)
      return
    }

    if (!isHttpUrl(normalizedFallback)) {
      setFallbackTestMessage('Enter a valid http:// or https:// URL.')
      setFallbackTestOk(false)
      return
    }

    setIsTestingFallback(true)
    try {
      await testApiBaseUrl(normalizedFallback)
      setFallbackTestMessage('Fallback URL is reachable.')
      setFallbackTestOk(true)
    } catch (error) {
      setFallbackTestMessage(error instanceof Error ? error.message : 'Unable to reach fallback URL.')
      setFallbackTestOk(false)
    } finally {
      setIsTestingFallback(false)
    }
  }

  async function handleSaveApiSettings() {
    const normalizedPrimary = primaryApiUrl.trim().replace(/\/+$/, '')
    const normalizedFallback = fallbackApiUrl.trim().replace(/\/+$/, '')
    setApiSettingsError('')

    if (!normalizedPrimary) {
      setApiSettingsError('Primary base URL is required.')
      return
    }

    if (!isHttpUrl(normalizedPrimary)) {
      setApiSettingsError('Please enter a valid primary URL (http:// or https://).')
      return
    }

    if (normalizedFallback && !isHttpUrl(normalizedFallback)) {
      setApiSettingsError('Fallback URL must be valid (http:// or https://), or leave it empty.')
      return
    }

    setIsSavingApiSettings(true)
    try {
      setApiBaseUrlOverrides({
        primary: normalizedPrimary,
        fallback: normalizedFallback,
      })
      await saveApiBaseConfig({
        primary: normalizedPrimary,
        fallback: normalizedFallback,
      })

      const localConfig = await loadConfig()
      if (localConfig) {
        await saveConfig({
          ...localConfig,
          api_base_url_primary: normalizedPrimary,
          api_base_url_fallback: normalizedFallback,
        })
      }

      setShowApiModal(false)
      setLogoUri(null)
    } catch (saveError) {
      setApiSettingsError(saveError instanceof Error ? saveError.message : 'Unable to save API URLs.')
    } finally {
      setIsSavingApiSettings(false)
    }
  }

  async function handleSubmit() {
    setError('')

    try {
      const config = await loadConfig()
      const sessionUser = await login(username, password, config?.terminal_name)

      if (config) {
        const terminal = await lookupTerminal(config.terminal_name, resolveBranchCode(config))

        if (
          sessionUser.branchId != null &&
          terminal.branch_id != null &&
          Number(sessionUser.branchId) !== Number(terminal.branch_id)
        ) {
          await logout()
          setError('This account belongs to a different branch than this terminal.')
          return
        }

        setCurrentOrn(terminal.current_or)
        const next = mergeTerminalIntoConfig(config, terminal)
        await saveConfig(next)
        setConfig(next)
      }

      navigation.replace('MainPos')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.')
    }
  }

  return (
    <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={[commonStyles.card, { width: '50%', minWidth: 280, maxWidth: 520 }]}>
        {isDesktop ? (
          <View style={{ alignItems: 'flex-end', marginBottom: spacing.sm }}>
            <Pressable
              onPress={handleOpenApiModal}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 18, lineHeight: 20 }}>⚙</Text>
            </Pressable>
          </View>
        ) : null}
        {logoUri ? (
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Pressable onPress={handleLogoPress} accessibilityLabel="Business logo">
              <Image source={{ uri: logoUri }} style={{ width: 300, height: 110, maxWidth: '100%' }} resizeMode="contain" />
            </Pressable>
          </View>
        ) : null}
        <Text style={commonStyles.title}>Cashier Sign In</Text>
        <Text style={commonStyles.subtitle}>Use your existing POS credentials.</Text>
        {registeredBranchLabel ? (
          <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>
            Registered branch: {registeredBranchLabel}
          </Text>
        ) : null}
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

      <Modal visible={showApiModal} transparent animationType="fade" onRequestClose={() => setShowApiModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
          }}
        >
          <View style={[commonStyles.card, { width: '100%', maxWidth: 560 }]}>
            <Text style={commonStyles.title}>API Settings</Text>
            <Text style={commonStyles.subtitle}>Update base URL and fallback base URL for this desktop.</Text>

            <Text style={commonStyles.label}>Base URL (Primary)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <TextInput
                style={[commonStyles.input, { flex: 1, marginBottom: 0 }]}
                value={primaryApiUrl}
                onChangeText={(value) => {
                  setPrimaryApiUrl(value)
                  setPrimaryTestMessage('')
                  setPrimaryTestOk(null)
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://pos-api.example.com"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isTestingPrimary || isSavingApiSettings ? 0.5 : 1,
                }}
                onPress={() => void handleTestPrimary()}
                disabled={isTestingPrimary || isSavingApiSettings}
                accessibilityLabel="Test primary connection"
              >
                <Text style={{ color: colors.text, fontSize: 17 }}>{isTestingPrimary ? '…' : '🔌'}</Text>
              </Pressable>
            </View>
            {primaryTestMessage ? (
              <Text style={{ color: primaryTestOk ? colors.good : colors.bad, marginBottom: spacing.md }}>
                {primaryTestMessage}
              </Text>
            ) : null}

            <Text style={commonStyles.label}>Fallback Base URL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <TextInput
                style={[commonStyles.input, { flex: 1, marginBottom: 0 }]}
                value={fallbackApiUrl}
                onChangeText={(value) => {
                  setFallbackApiUrl(value)
                  setFallbackTestMessage('')
                  setFallbackTestOk(null)
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.10:5000"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isTestingFallback || isSavingApiSettings ? 0.5 : 1,
                }}
                onPress={() => void handleTestFallback()}
                disabled={isTestingFallback || isSavingApiSettings}
                accessibilityLabel="Test fallback connection"
              >
                <Text style={{ color: colors.text, fontSize: 17 }}>{isTestingFallback ? '…' : '🔌'}</Text>
              </Pressable>
            </View>
            {fallbackTestMessage ? (
              <Text style={{ color: fallbackTestOk ? colors.good : colors.bad, marginBottom: spacing.md }}>
                {fallbackTestMessage}
              </Text>
            ) : null}

            {apiSettingsError ? <Text style={commonStyles.error}>{apiSettingsError}</Text> : null}

            <View style={[commonStyles.row, { justifyContent: 'flex-end' }]}>
              <Pressable
                style={[commonStyles.button, commonStyles.buttonSecondary]}
                onPress={() => setShowApiModal(false)}
                disabled={isSavingApiSettings}
              >
                <Text style={commonStyles.buttonTextLight}>Cancel</Text>
              </Pressable>
              <Pressable style={commonStyles.button} onPress={() => void handleSaveApiSettings()} disabled={isSavingApiSettings}>
                <Text style={commonStyles.buttonText}>{isSavingApiSettings ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showReregisterModal}
        title="Switch terminal registration?"
        message="This will clear this device's terminal setup and return to Machine Registration. Continue?"
        confirmLabel={isReregistering ? 'Continuing...' : 'Continue'}
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void handleConfirmReregister()}
        onCancel={() => {
          if (!isReregistering) {
            setShowReregisterModal(false)
          }
        }}
      />
    </View>
  )
}
