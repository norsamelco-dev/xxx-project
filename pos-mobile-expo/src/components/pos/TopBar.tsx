import { Pressable, Text, View } from 'react-native'
import { colors, spacing } from '../../styles/theme'
import { alertMessage, confirmAsync } from '../../utils/confirm'
import { useEffect, useState } from 'react'
import MenuDropdown from './MenuDropdown'
import SalesSeriesSelectModal from '../modals/SalesSeriesSelectModal'
import {
  MENU_RECEIPT_LAYOUT_OPTIONS,
  MENU_TEST_PRINT_LAYOUT_OPTIONS,
  MENU_X_REPORT_LAYOUT_OPTIONS,
  MENU_Z_REPORT_LAYOUT_OPTIONS,
  type ReceiptLayoutId,
  type ReportLayoutId,
  type TestPrintLayoutId,
} from '../../types/printLayouts'
import type { MenuDropdownItem } from './MenuDropdown'
import type { PosSummary, SeriesCloseRequirements } from '../../types/pos'

type Props = {
  seriesOptions: string[]
  activeSeriesNo: string | null
  onSelectSeries: (seriesNo: string) => void
  onCreateSeries: () => void
  onCloseSeries: (seriesNo: string) => Promise<void>
  onGetCloseRequirements: (seriesNo: string) => Promise<SeriesCloseRequirements>
  onGetSeriesSummary: (seriesNo: string) => Promise<PosSummary>
  isClosingSeries?: boolean
  onXReport: () => void
  onZReport: () => void
  onCashCountSheet: () => void
  onDefaultPrinter: () => void
  onStartingBalance: () => void
  onSalesTransactions: () => void
  onTheme: () => void
  testPrintLayout: TestPrintLayoutId
  receiptLayout: ReceiptLayoutId
  xReportLayout: ReportLayoutId
  zReportLayout: ReportLayoutId
  onSelectTestPrintLayout: (layoutId: TestPrintLayoutId) => void
  onSelectReceiptLayout: (layoutId: ReceiptLayoutId) => void
  onSelectXReportLayout: (layoutId: ReportLayoutId) => void
  onSelectZReportLayout: (layoutId: ReportLayoutId) => void
  onReregister: () => void
  onLogout: () => void
  onAbout: () => void
  onTerminalInformation: () => void
}

export default function TopBar({
  seriesOptions,
  activeSeriesNo,
  onSelectSeries,
  onCreateSeries,
  onCloseSeries,
  onGetCloseRequirements,
  onGetSeriesSummary,
  isClosingSeries = false,
  onXReport,
  onZReport,
  onCashCountSheet,
  onDefaultPrinter,
  onStartingBalance,
  onSalesTransactions,
  onTheme,
  testPrintLayout,
  receiptLayout,
  xReportLayout,
  zReportLayout,
  onSelectTestPrintLayout,
  onSelectReceiptLayout,
  onSelectXReportLayout,
  onSelectZReportLayout,
  onReregister,
  onLogout,
  onAbout,
  onTerminalInformation,
}: Props) {
  const canCreateSeries = seriesOptions.length === 0
  const canRunReports = !canCreateSeries
  const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false)
  const [closingSeriesNo, setClosingSeriesNo] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [closeRequirementsBySeries, setCloseRequirementsBySeries] = useState<Record<string, SeriesCloseRequirements>>({})
  const [summaryBySeries, setSummaryBySeries] = useState<Record<string, PosSummary>>({})
  const [isLoadingCloseRequirements, setIsLoadingCloseRequirements] = useState(false)
  const [isLoadingSeriesSummaries, setIsLoadingSeriesSummaries] = useState(false)

  function closeMenus() {
    setOpenMenuId(null)
  }

  function handleLogoutPress() {
    if (seriesOptions.length > 0 || Boolean(activeSeriesNo)) {
      alertMessage(
        'Logout blocked',
        'Close all active sales series before logging out.',
      )
      return
    }

    onLogout()
  }

  useEffect(() => {
    let isMounted = true

    if (!seriesDropdownOpen || seriesOptions.length === 0) {
      return () => {
        isMounted = false
      }
    }

    setIsLoadingCloseRequirements(true)
    setIsLoadingSeriesSummaries(true)

    void Promise.allSettled(
      seriesOptions.map(async (seriesNo) => {
        const requirements = await onGetCloseRequirements(seriesNo)
        return { seriesNo, requirements }
      }),
    )
      .then((results) => {
        if (!isMounted) {
          return
        }

        const next: Record<string, SeriesCloseRequirements> = {}
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.seriesNo] = result.value.requirements
          }
        }
        setCloseRequirementsBySeries(next)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCloseRequirements(false)
        }
      })

    void Promise.allSettled(
      seriesOptions.map(async (seriesNo) => {
        const summary = await onGetSeriesSummary(seriesNo)
        return { seriesNo, summary }
      }),
    )
      .then((results) => {
        if (!isMounted) {
          return
        }
        const next: Record<string, PosSummary> = {}
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.seriesNo] = result.value.summary
          }
        }
        setSummaryBySeries(next)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSeriesSummaries(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [seriesDropdownOpen, seriesOptions, onGetCloseRequirements, onGetSeriesSummary])

  async function handleCloseSeriesPress(seriesNo: string) {
    let requirements: SeriesCloseRequirements

    try {
      requirements = await onGetCloseRequirements(seriesNo)
    } catch (error) {
      alertMessage(
        'Unable to verify close requirements',
        error instanceof Error ? error.message : 'Failed to check report requirements.',
      )
      return
    }

    if (!requirements.can_close) {
      const missing = requirements.missing_reports.join(' and ')
      alertMessage(
        'Reports required before close',
        `Please print ${missing} report${requirements.missing_reports.length > 1 ? 's' : ''} for this sales series before closing.`,
      )
      return
    }

    const confirmed = await confirmAsync(
      'Close sales series?',
      'Closing this series will end your shift. You must start a new series before you can sell again.',
      'Close',
      'Cancel',
    )

    if (!confirmed) {
      return
    }

    setClosingSeriesNo(seriesNo)

    try {
      await onCloseSeries(seriesNo)
      setSeriesDropdownOpen(false)
      alertMessage('Series closed', 'Your shift has ended for this sales series. Tap New Series to continue selling.')
    } catch (error) {
      alertMessage('Unable to close series', error instanceof Error ? error.message : 'Failed to close series.')
    } finally {
      setClosingSeriesNo(null)
    }
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, flex: 1 }}>
          <MenuDropdown
            label="File"
            menuIcon="📄"
            isOpen={openMenuId === 'file'}
            onOpen={() => setOpenMenuId('file')}
            onClose={closeMenus}
            items={[
              {
                id: 'new-series',
                label: 'New Series',
                icon: '+',
                disabled: !canCreateSeries,
                onPress: onCreateSeries,
              },
              {
                id: 'starting-balance',
                label: 'Starting Balance',
                icon: '₱',
                disabled: !activeSeriesNo,
                onPress: onStartingBalance,
              },
              {
                id: 'sales-transactions',
                label: 'Sales Transaction List',
                icon: '≡',
                onPress: onSalesTransactions,
              },
              {
                id: 'default-printer',
                label: 'Default Printer',
                icon: '🖨',
                onPress: onDefaultPrinter,
              },
              {
                id: 'theme',
                label: 'Theme',
                icon: '◐',
                onPress: onTheme,
              },
              {
                id: 'reregister',
                label: 'Re-register Terminal',
                icon: '↻',
                onPress: onReregister,
              },
              {
                id: 'logout',
                label: 'Logout',
                icon: '⎋',
                onPress: handleLogoutPress,
              },
            ]}
          />
          <MenuDropdown
            label="Print Layouts"
            menuIcon="P"
            isOpen={openMenuId === 'print-layouts'}
            onOpen={() => setOpenMenuId('print-layouts')}
            onClose={closeMenus}
            items={buildPrintLayoutMenuItems({
              testPrintLayout,
              receiptLayout,
              xReportLayout,
              zReportLayout,
              onSelectTestPrintLayout,
              onSelectReceiptLayout,
              onSelectXReportLayout,
              onSelectZReportLayout,
            })}
          />
          <MenuDropdown
            label="Report"
            menuIcon="📊"
            isOpen={openMenuId === 'report'}
            onOpen={() => setOpenMenuId('report')}
            onClose={closeMenus}
            items={[
              {
                id: 'x-report',
                label: 'X Report',
                icon: 'X',
                tag: 'required',
                disabled: !canRunReports,
                onPress: onXReport,
              },
              {
                id: 'z-report',
                label: 'Z Report',
                icon: 'Z',
                tag: 'required',
                disabled: !canRunReports,
                onPress: onZReport,
              },
              {
                id: 'cash-count',
                label: 'Cash Count Sheet',
                icon: '₱',
                tag: 'optional',
                disabled: !canRunReports,
                onPress: onCashCountSheet,
              },
            ]}
          />
          <MenuDropdown
            label="Help"
            menuIcon="?"
            isOpen={openMenuId === 'help'}
            onOpen={() => setOpenMenuId('help')}
            onClose={closeMenus}
            items={[
              {
                id: 'about',
                label: 'About us',
                icon: 'i',
                onPress: onAbout,
              },
              {
                id: 'terminal-info',
                label: 'Terminal Information',
                icon: 'T',
                onPress: onTerminalInformation,
              },
            ]}
          />
        </View>

        {seriesOptions.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sales series no.</Text>
            <Pressable
              style={[
                seriesDropdownStyle,
                !activeSeriesNo && { backgroundColor: colors.surfaceAlt, opacity: 0.9 },
              ]}
              onPress={() => setSeriesDropdownOpen(true)}
            >
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {activeSeriesNo || seriesOptions[0]}
              </Text>
              <Text style={{ color: colors.textMuted, fontWeight: '700' }}>v</Text>
            </Pressable>

            <SalesSeriesSelectModal
              visible={seriesDropdownOpen}
              seriesOptions={seriesOptions}
              activeSeriesNo={activeSeriesNo}
              closeRequirementsBySeries={closeRequirementsBySeries}
              summaryBySeries={summaryBySeries}
              isLoadingCloseRequirements={isLoadingCloseRequirements}
              isLoadingSeriesSummaries={isLoadingSeriesSummaries}
              closingSeriesNo={closingSeriesNo}
              isClosingSeries={isClosingSeries}
              onSelectSeries={(series) => {
                onSelectSeries(series)
                setSeriesDropdownOpen(false)
              }}
              onCloseSeries={(series) => void handleCloseSeriesPress(series)}
              onDismiss={() => setSeriesDropdownOpen(false)}
            />
          </View>
        ) : null}
      </View>
      {seriesOptions.length === 0 ? (
        <Text style={{ color: colors.warning, fontSize: 12, marginBottom: spacing.sm }}>
          No open sales series for this terminal and MIN. Use File → New Series to enable the cart.
        </Text>
      ) : null}
    </View>
  )
}

function buildPrintLayoutMenuItems({
  testPrintLayout,
  receiptLayout,
  xReportLayout,
  zReportLayout,
  onSelectTestPrintLayout,
  onSelectReceiptLayout,
  onSelectXReportLayout,
  onSelectZReportLayout,
}: {
  testPrintLayout: TestPrintLayoutId
  receiptLayout: ReceiptLayoutId
  xReportLayout: ReportLayoutId
  zReportLayout: ReportLayoutId
  onSelectTestPrintLayout: (layoutId: TestPrintLayoutId) => void
  onSelectReceiptLayout: (layoutId: ReceiptLayoutId) => void
  onSelectXReportLayout: (layoutId: ReportLayoutId) => void
  onSelectZReportLayout: (layoutId: ReportLayoutId) => void
}): MenuDropdownItem[] {
  const items: MenuDropdownItem[] = [
    {
      id: 'section-test-print',
      label: 'Test print',
      disabled: true,
      onPress: () => undefined,
    },
  ]

  for (const option of MENU_TEST_PRINT_LAYOUT_OPTIONS) {
    items.push({
      id: `test-${option.id}`,
      label: option.label,
      selected: testPrintLayout === option.id,
      onPress: () => onSelectTestPrintLayout(option.id),
    })
  }

  items.push({
    id: 'section-receipt',
    label: 'Sales receipt',
    disabled: true,
    onPress: () => undefined,
  })

  for (const option of MENU_RECEIPT_LAYOUT_OPTIONS) {
    items.push({
      id: `receipt-${option.id}`,
      label: option.label,
      selected: receiptLayout === option.id,
      onPress: () => onSelectReceiptLayout(option.id),
    })
  }

  items.push({
    id: 'section-reports',
    label: 'Reports',
    disabled: true,
    onPress: () => undefined,
  })

  for (const option of MENU_X_REPORT_LAYOUT_OPTIONS) {
    items.push({
      id: `x-report-${option.id}`,
      label: option.label,
      selected: xReportLayout === option.id,
      onPress: () => onSelectXReportLayout(option.id),
    })
  }

  for (const option of MENU_Z_REPORT_LAYOUT_OPTIONS) {
    items.push({
      id: `z-report-${option.id}`,
      label: option.label,
      selected: zReportLayout === option.id,
      onPress: () => onSelectZReportLayout(option.id),
    })
  }

  return items
}

const seriesDropdownStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: spacing.md,
  backgroundColor: colors.surfaceAlt,
  borderRadius: 8,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
  minWidth: 180,
  maxWidth: 280,
}
