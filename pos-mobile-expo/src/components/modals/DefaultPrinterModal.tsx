import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native'
import { listPrinters, printTestPage, type PrinterDevice } from '../../services/printer/printerService'
import type { PosConfig } from '../../types/config'
import { resolveTestPrintLayout, TEST_PRINT_LAYOUT_OPTIONS } from '../../types/printLayouts'
import { colors, spacing } from '../../styles/theme'

type Props = {
  visible: boolean
  config: PosConfig
  dismissible?: boolean
  saveLabel?: string
  onClose?: () => void
  onSaved: (config: PosConfig) => void | Promise<void>
}

function connectionLabel(connectionType?: PrinterDevice['connectionType']) {
  if (connectionType === 'bluetooth') {
    return 'Paired Bluetooth'
  }
  if (connectionType === 'usb') {
    return 'USB device'
  }
  if (connectionType === 'system') {
    return 'Installed on PC'
  }
  return null
}

export default function DefaultPrinterModal({
  visible,
  config,
  dismissible = true,
  saveLabel = 'Save printer',
  onClose,
  onSaved,
}: Props) {
  const [printers, setPrinters] = useState<PrinterDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testPrintingId, setTestPrintingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState(config.default_printer_id || config.default_printer || '')

  const loadPrinterList = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const devices = await listPrinters()
      setPrinters(devices)

      if (devices.length === 0) {
        setError('No printers found. Pair a Bluetooth printer on Android, or install a printer on this PC.')
        return
      }

      const current =
        devices.find((device) => device.id === config.default_printer_id) ||
        devices.find((device) => device.name === config.default_printer) ||
        devices[0]

      if (current) {
        setSelectedId(current.id)
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load printers.'
      setError(message)
      setPrinters([])
    } finally {
      setLoading(false)
    }
  }, [config.default_printer, config.default_printer_id])

  useEffect(() => {
    if (!visible) {
      return
    }

    setSelectedId(config.default_printer_id || config.default_printer || '')
    void loadPrinterList()
  }, [visible, config.default_printer, config.default_printer_id, loadPrinterList])

  async function handleSave() {
    const selected = printers.find((device) => device.id === selectedId) || printers[0]

    if (!selected) {
      setError('Select a printer before saving.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const next: PosConfig = {
        ...config,
        default_printer: selected.name,
        default_printer_id: selected.id,
        default_printer_connection: selected.connectionType,
      }

      await onSaved(next)
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save printer.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const isTestPrinting = testPrintingId !== null
  const testPrintLayout = resolveTestPrintLayout(config.test_print_layout)
  const testPrintLayoutLabel =
    TEST_PRINT_LAYOUT_OPTIONS.find((option) => option.id === testPrintLayout)?.label || testPrintLayout

  async function handleTestPrint(printer: PrinterDevice) {
    setTestPrintingId(printer.id)
    setError(null)

    try {
      await printTestPage(printer, config)
      Alert.alert('Test print sent', `A test receipt was sent to ${printer.name}.`)
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : 'Test print failed.'
      setError(message)
      Alert.alert('Test print failed', `${printer.name}: ${message}`)
    } finally {
      setTestPrintingId(null)
    }
  }

  function handleDismiss() {
    if (!dismissible || saving || isTestPrinting) {
      return
    }
    onClose?.()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24, alignItems: 'center' }}
        onPress={handleDismiss}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 520,
            maxHeight: '85%',
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm }}>
            Default Printer
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.md, lineHeight: 18 }}>
            Tap a printer to select it as default. Use Test on each row to print a sample. Layout: {testPrintLayoutLabel} (change in Test Print Layout menu).
          </Text>

          {config.default_printer ? (
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Current default</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{config.default_printer}</Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={printers}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 280 }}
              scrollEnabled
              ListEmptyComponent={
                error ? <Text style={{ color: colors.bad, marginBottom: 12 }}>{error}</Text> : null
              }
              renderItem={({ item }) => {
                const isSelected = selectedId === item.id
                const typeLabel = connectionLabel(item.connectionType)
                const isRowPrinting = testPrintingId === item.id
                const rowBusy = isRowPrinting || (isTestPrinting && !isRowPrinting)

                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accent : colors.border,
                    }}
                  >
                    <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => setSelectedId(item.id)}>
                      <Text
                        style={{
                          color: isSelected ? '#0f172a' : colors.text,
                          fontWeight: '600',
                        }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      {typeLabel ? (
                        <Text
                          style={{
                            color: isSelected ? '#334155' : colors.textMuted,
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          {typeLabel}
                        </Text>
                      ) : null}
                    </Pressable>

                    <Pressable
                      style={{
                        backgroundColor: isSelected ? '#0f172a' : colors.good,
                        borderRadius: 8,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.sm,
                        minWidth: 72,
                        opacity: rowBusy ? 0.5 : 1,
                      }}
                      onPress={(event) => {
                        event.stopPropagation()
                        void handleTestPrint(item)
                      }}
                      disabled={loading || saving || rowBusy}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.accent : '#052e16',
                          fontWeight: '800',
                          fontSize: 12,
                          textAlign: 'center',
                        }}
                      >
                        {isRowPrinting ? 'Printing...' : 'Test'}
                      </Text>
                    </Pressable>
                  </View>
                )
              }}
            />
          )}

          {error && !loading && printers.length > 0 ? (
            <Text style={{ color: colors.bad, marginBottom: spacing.sm, fontSize: 12 }}>{error}</Text>
          ) : null}

          <Pressable
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              padding: spacing.md,
              marginBottom: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: loading || saving || isTestPrinting ? 0.5 : 1,
            }}
            onPress={() => void loadPrinterList()}
            disabled={loading || saving || isTestPrinting}
          >
            <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.text }}>Refresh printer list</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {dismissible ? (
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 8,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: saving || isTestPrinting ? 0.5 : 1,
                }}
                onPress={handleDismiss}
                disabled={saving || isTestPrinting}
              >
                <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 8,
                padding: spacing.md,
                opacity: !printers.length || loading || saving || isTestPrinting ? 0.5 : 1,
              }}
              onPress={() => void handleSave()}
              disabled={!printers.length || loading || saving || isTestPrinting}
            >
              <Text style={{ textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                {saving ? 'Saving...' : saveLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
