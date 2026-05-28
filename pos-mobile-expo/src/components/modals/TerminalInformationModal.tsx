import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'
import { lookupTerminal } from '../../services/api/posApi'
import { mergeTerminalIntoConfig } from '../../services/config/terminalConfig'
import { saveConfig } from '../../services/config/configStore'
import type { PosConfig } from '../../types/config'
import type { TerminalLookup } from '../../types/pos'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  config: PosConfig
  isPrinting?: boolean
  onClose: () => void
  onPrint: (terminal: TerminalLookup | null) => void | Promise<void>
  onTerminalSynced?: (config: PosConfig) => void
}

function formatOrDisplay(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-'
  }
  return String(Math.floor(Number(value))).padStart(8, '0')
}

function formatOrRange(terminal: TerminalLookup | null) {
  if (!terminal) {
    return '-'
  }
  const start = terminal.or_start
  const end = terminal.or_end
  if (start == null && end == null) {
    return '-'
  }
  return `${formatOrDisplay(start)} – ${formatOrDisplay(end)}`
}

export default function TerminalInformationModal({
  visible,
  config,
  isPrinting = false,
  onClose,
  onPrint,
  onTerminalSynced,
}: Props) {
  const [terminal, setTerminal] = useState<TerminalLookup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadWarning, setLoadWarning] = useState('')

  useEffect(() => {
    if (!visible) {
      setTerminal(null)
      setLoadWarning('')
      return
    }

    let isMounted = true
    setIsLoading(true)
    setLoadWarning('')

    void lookupTerminal(config.terminal_name)
      .then(async (data) => {
        if (!isMounted) {
          return
        }
        setTerminal(data)
        const next = mergeTerminalIntoConfig(config, data)
        await saveConfig(next)
        onTerminalSynced?.(next)
      })
      .catch((loadError) => {
        if (!isMounted) {
          return
        }
        setTerminal(null)
        setLoadWarning(
          loadError instanceof Error
            ? `${loadError.message} Showing saved terminal details.`
            : 'Unable to refresh from server. Showing saved terminal details.',
        )
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only when modal opens or terminal changes
  }, [visible, config.terminal_name])

  const branch = terminal?.branch || config.branch || '-'
  const status = terminal?.is_active === false ? 'Inactive' : terminal ? 'Active' : '-'
  const currentOr = terminal?.current_or != null ? formatOrDisplay(terminal.current_or) : '-'
  const busy = isLoading || isPrinting

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 480,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>
            Terminal Information
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
          ) : (
            <View style={{ gap: spacing.md }}>
              {loadWarning ? (
                <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 18 }}>{loadWarning}</Text>
              ) : null}
              <DetailRow label="Terminal" value={config.terminal_name || '-'} />
              <DetailRow label="Branch" value={branch} />
              <DetailRow label="MIN #" value={config.min_number || terminal?.min_number || '-'} />
              <DetailRow label="Serial #" value={config.serial_no || terminal?.serial_no || '-'} />
              <DetailRow label="PTU #" value={config.ptu_no || terminal?.ptu_no || '-'} />
              <DetailRow label="Current OR" value={currentOr} />
              <DetailRow label="OR range" value={formatOrRange(terminal)} />
              <DetailRow label="Status" value={status} />
              <DetailRow label="Default printer" value={config.default_printer || '-'} />
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.surfaceAlt,
                borderRadius: 8,
                padding: spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                opacity: busy ? 0.5 : 1,
              }}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                padding: spacing.md,
                alignItems: 'center',
                opacity: busy ? 0.5 : 1,
              }}
              onPress={() => void onPrint(terminal)}
              disabled={busy}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{isPrinting ? 'Printing…' : 'Print'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}
