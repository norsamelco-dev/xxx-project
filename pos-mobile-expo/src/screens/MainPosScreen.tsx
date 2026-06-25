import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDesktopKeyboardShortcuts } from '../hooks/useDesktopKeyboardShortcuts'
import { Alert, ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import TopBar from '../components/pos/TopBar'
import CartList from '../components/pos/CartList'
import RightSummaryPanel from '../components/pos/RightSummaryPanel'
import TerminalFooter from '../components/pos/TerminalFooter'
import ProductSearchModal from '../components/modals/ProductSearchModal'
import CustomQtyModal from '../components/modals/CustomQtyModal'
import DiscountModal from '../components/modals/DiscountModal'
import NewSeriesConfirmModal from '../components/modals/NewSeriesConfirmModal'
import StartingBalanceModal from '../components/modals/StartingBalanceModal'
import CheckoutModal from '../components/modals/CheckoutModal'
import AboutModal from '../components/modals/AboutModal'
import TerminalInformationModal from '../components/modals/TerminalInformationModal'
import CashCountSheetModal from '../components/modals/CashCountSheetModal'
import ConfirmModal from '../components/modals/ConfirmModal'
import DefaultPrinterModal from '../components/modals/DefaultPrinterModal'
import PrintLayoutPreviewModal from '../components/modals/PrintLayoutPreviewModal'
import ReportPrintPreviewModal, { type ReportPrintKind } from '../components/modals/ReportPrintPreviewModal'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePosSession } from '../context/PosSessionContext'
import { useToast } from '../context/ToastContext'
import {
  getPosReceiptContextPublic,
  getSummary,
  getXReport,
  lookupProduct,
  markSeriesReportPrinted,
  runZReport,
  setStartingBalance,
} from '../services/api/posApi'
import { saveConfig } from '../services/config/configStore'
import { resolveBranchCode } from '../services/config/terminalConfig'
import { buildReceiptByLayout } from '../services/printer/layouts/receiptLayouts'
import {
  applyPrintMarginsToText,
  normalizeLeftMargin,
  normalizeVerticalMargin,
} from '../services/printer/layouts/printLayoutUtils'
import { buildReadingReportByLayout } from '../services/printer/layouts/reportLayouts'
import { buildTestPrintByLayout } from '../services/printer/layouts/testPrintLayouts'
import {
  getReceiptLayoutPreviewInput,
  getReportLayoutPreviewInput,
  getSampleTestPrintLayoutInput,
} from '../services/printer/layoutPreviewSamples'
import { reregisterTerminal } from '../services/config/reregisterTerminal'
import {
  buildXReportText,
  buildZReportText,
  printCashCountSheet,
  printTerminalInfo,
  printXReport,
  printZReport,
} from '../services/printer/printerService'
import { alertMessage, confirmAsync } from '../utils/confirm'
import { getPrintLogoPreviewStyle, isPrintLogoEnabled } from '../utils/printLogo'
import type { RootStackParamList } from '../navigation/types'
import { clearCashCountDraft } from '../services/cashCount/cashCountDraftStore'
import type { CashCountSheetPrintInput } from '../types/cashCount'
import type { PosReport, ProductLookup, ReceiptHeading, TerminalLookup } from '../types/pos'
import type { PosConfig } from '../types/config'
import {
  RECEIPT_LAYOUT_OPTIONS,
  TEST_PRINT_LAYOUT_OPTIONS,
  X_REPORT_LAYOUT_OPTIONS,
  Z_REPORT_LAYOUT_OPTIONS,
  resolveReceiptLayout,
  resolveTestPrintLayout,
  resolveXReportLayout,
  resolveZReportLayout,
  type ReceiptLayoutId,
  type ReportLayoutId,
  type TestPrintLayoutId,
} from '../types/printLayouts'
import { colors, getActiveThemeId, setActiveTheme } from '../styles/theme'
import { commonStyles } from '../styles/common'
import { resolveThemeId, themeOptions, themePalettes, type ThemeId } from '../styles/themes'

type Props = NativeStackScreenProps<RootStackParamList, 'MainPos'>

type PendingConfirm =
  | { kind: 'empty-cart' }
  | { kind: 'remove-line'; lineId: string; itemName: string }

type PendingLayoutPreview =
  | {
      kind: 'test-print'
      layoutId: TestPrintLayoutId
      layoutLabel: string
      previewText: string
      marginLeft: number
      marginRight: number
      marginTop: number
      marginBottom: number
    }
  | {
      kind: 'receipt'
      layoutId: ReceiptLayoutId
      layoutLabel: string
      previewText: string
      marginLeft: number
      marginRight: number
      marginTop: number
      marginBottom: number
    }
  | {
      kind: 'x-report'
      layoutId: ReportLayoutId
      layoutLabel: string
      previewText: string
      marginLeft: number
      marginRight: number
      marginTop: number
      marginBottom: number
    }
  | {
      kind: 'z-report'
      layoutId: ReportLayoutId
      layoutLabel: string
      previewText: string
      marginLeft: number
      marginRight: number
      marginTop: number
      marginBottom: number
    }

export default function MainPosScreen({ navigation }: Props) {
  const { user, logout } = useAuth()
  const {
    config,
    activeSeriesNo,
    seriesOptions,
    hasActiveSeries,
    currentOrnDisplay,
    summary,
    refreshSeries,
    selectSeries,
    createNewSeries,
    closeSeriesByNo,
    getCloseRequirementsBySeriesNo,
    refreshSummary,
    isBusy,
    setConfig,
  } = usePosSession()
  const {
    lines,
    pendingQty,
    totals,
    setPendingQty,
    setDiscountRate,
    addLine,
    incrementLineQty,
    decrementLineQty,
    updateLineQty,
    removeLine,
    emptyCart,
  } = useCart()
  const { showToast } = useToast()
  const [barcode, setBarcode] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [qtyOpen, setQtyOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [terminalInfoOpen, setTerminalInfoOpen] = useState(false)
  const [isPrintingTerminalInfo, setIsPrintingTerminalInfo] = useState(false)
  const [cashCountOpen, setCashCountOpen] = useState(false)
  const [isPrintingCashCount, setIsPrintingCashCount] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [printerOpen, setPrinterOpen] = useState(false)
  const [newSeriesOpen, setNewSeriesOpen] = useState(false)
  const [startingBalanceOpen, setStartingBalanceOpen] = useState(false)
  const [startingBalanceSeriesNo, setStartingBalanceSeriesNo] = useState<string | null>(null)
  const [startingBalanceSaved, setStartingBalanceSaved] = useState(true)
  const [isSavingStartingBalance, setIsSavingStartingBalance] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [receiptHeading, setReceiptHeading] = useState<ReceiptHeading | null>(null)
  const [pendingLayoutPreview, setPendingLayoutPreview] = useState<PendingLayoutPreview | null>(null)
  const [isSavingLayout, setIsSavingLayout] = useState(false)
  const [reportPrintKind, setReportPrintKind] = useState<ReportPrintKind | null>(null)
  const [reportPrintPreviewText, setReportPrintPreviewText] = useState('')
  const [reportPrintPayload, setReportPrintPayload] = useState<{
    report: PosReport
    heading: ReceiptHeading | null
    seriesNo: string
  } | null>(null)
  const [reportPrintLoading, setReportPrintLoading] = useState(false)
  const [reportPrintError, setReportPrintError] = useState<string | null>(null)
  const [isPrintingReport, setIsPrintingReport] = useState(false)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [isApplyingTheme, setIsApplyingTheme] = useState(false)
  const [isCartQtyEditorOpen, setIsCartQtyEditorOpen] = useState(false)

  const canTransact = hasActiveSeries && startingBalanceSaved
  const anyModalOpen =
    searchOpen ||
    qtyOpen ||
    discountOpen ||
    checkoutOpen ||
    newSeriesOpen ||
    startingBalanceOpen ||
    aboutOpen ||
    terminalInfoOpen ||
    cashCountOpen ||
    logoutConfirmOpen ||
    printerOpen ||
    pendingLayoutPreview !== null ||
    reportPrintKind !== null ||
    pendingConfirm !== null ||
    isCartQtyEditorOpen

  async function handleConfirmNewSeries() {
    try {
      const seriesNo = await createNewSeries()
      clearCashCountDraft()
      setStartingBalanceSeriesNo(seriesNo)
      setStartingBalanceSaved(false)
      setStartingBalanceOpen(true)
      setNewSeriesOpen(false)
    } catch (error) {
      Alert.alert('Unable to create series', error instanceof Error ? error.message : 'Failed.')
    }
  }

  async function handleSaveStartingBalance(startingBalance: number) {
    if (!startingBalanceSeriesNo) {
      Alert.alert('Missing series', 'Sales series is missing. Please create a new series again.')
      return
    }

    setIsSavingStartingBalance(true)

    try {
      await setStartingBalance(startingBalanceSeriesNo, startingBalance)
      setStartingBalanceSaved(true)
      setStartingBalanceOpen(false)
      await refreshSummary()
    } catch (error) {
      Alert.alert(
        'Unable to save starting balance',
        error instanceof Error ? error.message : 'Failed to save starting balance.',
      )
    } finally {
      setIsSavingStartingBalance(false)
    }
  }

  useEffect(() => {
    if (config?.terminal_name) {
      void refreshSeries()
      void refreshSummary()
    }
  }, [config?.terminal_name, activeSeriesNo, refreshSeries, refreshSummary])

  useEffect(() => {
    let isMounted = true
    const branchCode = resolveBranchCode(config)

    void getPosReceiptContextPublic(branchCode)
      .then((heading) => {
        if (isMounted) {
          setReceiptHeading(heading)
        }
      })
      .catch(() => {
        if (isMounted) {
          setReceiptHeading(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [config?.branch_code])

  useEffect(() => {
    const nextTheme = resolveThemeId(config?.ui_theme)
    if (getActiveThemeId() !== nextTheme) {
      setActiveTheme(nextTheme)
    }
  }, [config?.ui_theme])

  const addProduct = useCallback(
    async (product: ProductLookup) => {
      if (!canTransact) {
        Alert.alert('Sales series required', 'Create a sales series for this terminal before adding items.')
        return
      }

      try {
        await addLine({
          barcode: product.barcode,
          name: product.name,
          category: product.category,
          brand: product.brand,
          product_image_path: product.product_image_path ?? null,
          unit: product.unit,
          batch_id: product.batch_id,
          price: product.selling_price,
          qty: pendingQty,
        })
        setBarcode('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add item.'
        showToast(message, 'error')
      }
    },
    [canTransact, addLine, pendingQty, showToast],
  )

  async function handleScanSubmit() {
    if (!canTransact) {
      return
    }

    if (!barcode.trim()) {
      return
    }

    try {
      const product = await lookupProduct(barcode.trim())
      await addProduct(product)
    } catch (error) {
      Alert.alert('Product not found', error instanceof Error ? error.message : 'Lookup failed.')
    }
  }

  const handleCheckoutPress = useCallback(() => {
    if (!canTransact) {
      Alert.alert('Sales series required', 'Create a sales series for this terminal before checkout.')
      return
    }

    if (!lines.length) {
      Alert.alert('Empty cart', 'Add at least one item before checkout.')
      return
    }

    setCheckoutOpen(true)
  }, [canTransact, lines.length])

  const openCustomQtyModal = useCallback(() => {
    if (!canTransact) {
      return
    }
    setQtyOpen(true)
  }, [canTransact])

  function handleEmptyCartRequest() {
    if (!lines.length) {
      return
    }
    setPendingConfirm({ kind: 'empty-cart' })
  }

  function handleRemoveRequest(lineId: string) {
    const line = lines.find((entry) => entry.id === lineId)
    setPendingConfirm({
      kind: 'remove-line',
      lineId,
      itemName: line?.name || 'this item',
    })
  }

  async function handleIncrementQty(lineId: string) {
    try {
      await incrementLineQty(lineId)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to increase quantity.', 'error')
    }
  }

  async function handleDecrementQty(lineId: string) {
    try {
      await decrementLineQty(lineId)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to decrease quantity.', 'error')
    }
  }

  async function handleUpdateLineQty(lineId: string, qty: number) {
    try {
      await updateLineQty(lineId, qty)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update quantity.', 'error')
    }
  }

  function handleConfirmPendingAction() {
    if (!pendingConfirm) {
      return
    }

    if (pendingConfirm.kind === 'empty-cart') {
      emptyCart()
    } else {
      removeLine(pendingConfirm.lineId)
    }

    setPendingConfirm(null)
  }

  useDesktopKeyboardShortcuts({
    enabled: canTransact && !anyModalOpen,
    onSearch: () => setSearchOpen(true),
    onCustomQty: openCustomQtyModal,
    onDiscount: () => setDiscountOpen(true),
    onCheckout: handleCheckoutPress,
  })

  const printLogoPreview = useMemo(() => getPrintLogoPreviewStyle(receiptHeading), [receiptHeading])

  if (!config) {
    return (
      <View style={[commonStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[commonStyles.subtitle, { marginTop: 16 }]}>Redirecting...</Text>
      </View>
    )
  }

  const activeConfig = config
  const testPrintLayout = resolveTestPrintLayout(activeConfig.test_print_layout)
  const receiptLayout = resolveReceiptLayout(activeConfig.receipt_layout)
  const xReportLayout = resolveXReportLayout(activeConfig.x_report_layout)
  const zReportLayout = resolveZReportLayout(activeConfig.z_report_layout)
  const savedMarginLeft = normalizeLeftMargin(activeConfig.print_margin_left)
  const savedMarginRight = normalizeLeftMargin(activeConfig.print_margin_right)
  const savedMarginTop = normalizeVerticalMargin(activeConfig.print_margin_top)
  const savedMarginBottom = normalizeVerticalMargin(activeConfig.print_margin_bottom)
  const logoPreviewEnabled = isPrintLogoEnabled(receiptHeading)

  function buildPreviewText(preview: PendingLayoutPreview) {
    const margins = {
      left: preview.marginLeft,
      right: preview.marginRight,
      top: preview.marginTop,
      bottom: preview.marginBottom,
    }
    const cashierName = user?.fullName || user?.username || 'Cashier'

    if (preview.kind === 'test-print') {
      const baseText = buildTestPrintByLayout(
        preview.layoutId,
        getSampleTestPrintLayoutInput(activeConfig, receiptHeading),
      )
      return applyPrintMarginsToText(baseText, margins)
    }

    if (preview.kind === 'receipt') {
      const baseText = buildReceiptByLayout(
        preview.layoutId,
        getReceiptLayoutPreviewInput({
          config: activeConfig,
          heading: receiptHeading,
          cashierName,
          cashierId: user?.userId,
          seriesNo: activeSeriesNo,
          orsiDisplay: currentOrnDisplay,
          cartLines: lines.length ? lines : undefined,
          cartTotals: lines.length ? totals : undefined,
          discountRate: totals.discountRate,
        }),
      )
      return applyPrintMarginsToText(baseText, margins)
    }

    const reportKind = preview.kind === 'x-report' ? 'X' : 'Z'
    const baseText = buildReadingReportByLayout(
      preview.layoutId,
      getReportLayoutPreviewInput({
        config: activeConfig,
        heading: receiptHeading,
        cashierName,
        cashierId: user?.userId,
        reportKind,
      }),
    )
    return applyPrintMarginsToText(baseText, margins)
  }

  function handleSelectTestPrintLayout(layoutId: TestPrintLayoutId) {
    const layoutLabel = TEST_PRINT_LAYOUT_OPTIONS.find((option) => option.id === layoutId)?.label || layoutId
    const draft: PendingLayoutPreview = {
      kind: 'test-print',
      layoutId,
      layoutLabel,
      previewText: '',
      marginLeft: savedMarginLeft,
      marginRight: savedMarginRight,
      marginTop: savedMarginTop,
      marginBottom: savedMarginBottom,
    }
    setPendingLayoutPreview({ ...draft, previewText: buildPreviewText(draft) })
  }

  function handleSelectReceiptLayout(layoutId: ReceiptLayoutId) {
    const layoutLabel = RECEIPT_LAYOUT_OPTIONS.find((option) => option.id === layoutId)?.label || layoutId
    const margins = {
      left: savedMarginLeft,
      right: savedMarginRight,
      top: savedMarginTop,
      bottom: savedMarginBottom,
    }
    const draft: PendingLayoutPreview = {
      kind: 'receipt',
      layoutId,
      layoutLabel,
      previewText: '',
      marginLeft: margins.left,
      marginRight: margins.right,
      marginTop: margins.top,
      marginBottom: margins.bottom,
    }
    setPendingLayoutPreview({ ...draft, previewText: buildPreviewText(draft) })
  }

  function handleSelectXReportLayout(layoutId: ReportLayoutId) {
    const layoutLabel = X_REPORT_LAYOUT_OPTIONS.find((option) => option.id === layoutId)?.label || layoutId
    const margins = {
      left: savedMarginLeft,
      right: savedMarginRight,
      top: savedMarginTop,
      bottom: savedMarginBottom,
    }
    const draft: PendingLayoutPreview = {
      kind: 'x-report',
      layoutId,
      layoutLabel,
      previewText: '',
      marginLeft: margins.left,
      marginRight: margins.right,
      marginTop: margins.top,
      marginBottom: margins.bottom,
    }
    setPendingLayoutPreview({ ...draft, previewText: buildPreviewText(draft) })
  }

  function handleSelectZReportLayout(layoutId: ReportLayoutId) {
    const layoutLabel = Z_REPORT_LAYOUT_OPTIONS.find((option) => option.id === layoutId)?.label || layoutId
    const margins = {
      left: savedMarginLeft,
      right: savedMarginRight,
      top: savedMarginTop,
      bottom: savedMarginBottom,
    }
    const draft: PendingLayoutPreview = {
      kind: 'z-report',
      layoutId,
      layoutLabel,
      previewText: '',
      marginLeft: margins.left,
      marginRight: margins.right,
      marginTop: margins.top,
      marginBottom: margins.bottom,
    }
    setPendingLayoutPreview({ ...draft, previewText: buildPreviewText(draft) })
  }

  function handlePreviewMarginChange(field: 'left' | 'right' | 'top' | 'bottom', nextValue: number) {
    if (!pendingLayoutPreview) {
      return
    }

    const nextMargins = {
      left: pendingLayoutPreview.marginLeft,
      right: pendingLayoutPreview.marginRight,
      top: pendingLayoutPreview.marginTop,
      bottom: pendingLayoutPreview.marginBottom,
    }

    if (field === 'left') {
      nextMargins.left = normalizeLeftMargin(nextValue)
    } else if (field === 'right') {
      nextMargins.right = normalizeLeftMargin(nextValue)
    } else if (field === 'top') {
      nextMargins.top = normalizeVerticalMargin(nextValue)
    } else {
      nextMargins.bottom = normalizeVerticalMargin(nextValue)
    }

    const draft = {
      ...pendingLayoutPreview,
      marginLeft: nextMargins.left,
      marginRight: nextMargins.right,
      marginTop: nextMargins.top,
      marginBottom: nextMargins.bottom,
    }
    setPendingLayoutPreview({ ...draft, previewText: buildPreviewText(draft) })
  }

  function closeReportPrintModal() {
    if (isPrintingReport) {
      return
    }
    setReportPrintKind(null)
    setReportPrintPreviewText('')
    setReportPrintPayload(null)
    setReportPrintError(null)
    setReportPrintLoading(false)
  }

  function openReportPrintModal(
    kind: ReportPrintKind,
    report: PosReport,
    heading: ReceiptHeading | null,
    seriesNo: string,
  ) {
    const previewText =
      kind === 'X'
        ? buildXReportText({
            config: activeConfig,
            heading,
            cashierName: report.cashier_name || user?.fullName || user?.username || 'Cashier',
            cashierId: user?.userId,
            report,
          })
        : buildZReportText({
            config: activeConfig,
            heading,
            cashierName: report.cashier_name || user?.fullName || user?.username || 'Cashier',
            cashierId: user?.userId,
            report,
          })

    setReportPrintKind(kind)
    setReportPrintPreviewText(previewText)
    setReportPrintPayload({ report, heading, seriesNo })
    setReportPrintError(null)
    setReportPrintLoading(false)
  }

  async function handleOpenXReport() {
    if (!config?.terminal_name) {
      alertMessage('X Report', 'Terminal is not configured.')
      return
    }
    if (!activeSeriesNo) {
      alertMessage('X Report', 'Select an active sales series first.')
      return
    }

    setReportPrintKind('X')
    setReportPrintLoading(true)
    setReportPrintError(null)
    setReportPrintPreviewText('')
    setReportPrintPayload(null)

    try {
      const branchCode = resolveBranchCode(config)
      const [report, heading] = await Promise.all([
        getXReport(config.terminal_name, activeSeriesNo),
        receiptHeading ? Promise.resolve(receiptHeading) : getPosReceiptContextPublic(branchCode),
      ])
      if (!receiptHeading) {
        setReceiptHeading(heading)
      }
      openReportPrintModal('X', report, heading, activeSeriesNo)
    } catch (error) {
      setReportPrintError(error instanceof Error ? error.message : 'Unable to load X report.')
      setReportPrintLoading(false)
    }
  }

  async function handleOpenZReport() {
    if (!config?.terminal_name) {
      alertMessage('Z Report', 'Terminal is not configured.')
      return
    }
    if (!activeSeriesNo) {
      alertMessage('Z Report', 'Select an active sales series first.')
      return
    }

    setReportPrintKind('Z')
    setReportPrintLoading(true)
    setReportPrintError(null)
    setReportPrintPreviewText('')
    setReportPrintPayload(null)

    try {
      const data = await runZReport(config.terminal_name, activeSeriesNo)
      await refreshSeries()
      const heading = receiptHeading ?? (await getPosReceiptContextPublic(resolveBranchCode(config)))
      if (!receiptHeading) {
        setReceiptHeading(heading)
      }
      openReportPrintModal('Z', data, heading, activeSeriesNo)
      showToast('Z report ready — review before printing.', 'info')
    } catch (error) {
      setReportPrintError(error instanceof Error ? error.message : 'Unable to run Z report.')
      setReportPrintLoading(false)
    }
  }

  function handleOpenCashCountSheet() {
    if (!config?.terminal_name) {
      alertMessage('Cash Count Sheet', 'Terminal is not configured.')
      return
    }
    if (!activeSeriesNo) {
      alertMessage('Cash Count Sheet', 'Select an active sales series first.')
      return
    }
    setCashCountOpen(true)
  }

  async function handlePrintCashCountSheet(
    payload: Omit<CashCountSheetPrintInput, 'config'>,
  ) {
    if (!config) {
      return
    }

    if (!config.default_printer) {
      showToast('Set a default printer in File → Default Printer.', 'error')
      return
    }

    setIsPrintingCashCount(true)
    try {
      await printCashCountSheet(
        { ...payload, config },
        config.default_printer,
        config.default_printer_id,
        config.default_printer_connection,
      )
      showToast('Cash count sheet sent to printer.', 'info')
    } catch (error) {
      alertMessage('Print failed', error instanceof Error ? error.message : 'Unable to print cash count sheet.')
    } finally {
      setIsPrintingCashCount(false)
    }
  }

  async function handlePrintTerminalInfo(terminal: TerminalLookup | null) {
    if (!config) {
      return
    }

    if (!config.default_printer) {
      showToast('Set a default printer in File → Default Printer.', 'error')
      return
    }

    setIsPrintingTerminalInfo(true)
    try {
      await printTerminalInfo(
        { config, terminal },
        config.default_printer,
        config.default_printer_id,
        config.default_printer_connection,
      )
      showToast('Terminal information sent to printer.', 'info')
    } catch (error) {
      alertMessage('Print failed', error instanceof Error ? error.message : 'Unable to print terminal information.')
    } finally {
      setIsPrintingTerminalInfo(false)
    }
  }

  async function handlePrintReportFromModal() {
    if (!reportPrintKind || !reportPrintPayload || !config) {
      return
    }

    if (!config.default_printer) {
      const confirmed = await confirmAsync(
        'No default printer',
        'No default printer is configured. Continue without printing?',
        'Continue',
        'Cancel',
      )
      if (!confirmed) {
        return
      }
      closeReportPrintModal()
      return
    }

    const cashierName =
      reportPrintPayload.report.cashier_name || user?.fullName || user?.username || 'Cashier'
    const seriesNo = reportPrintPayload.seriesNo

    setIsPrintingReport(true)
    try {
      const printOptions = {
        config,
        heading: reportPrintPayload.heading,
        cashierName,
        cashierId: user?.userId,
        report: reportPrintPayload.report,
      }

      if (reportPrintKind === 'X') {
        await printXReport(
          printOptions,
          config.default_printer,
          config.default_printer_id,
          config.default_printer_connection,
        )
        if (seriesNo) {
          await markSeriesReportPrinted(seriesNo, config.terminal_name, 'X')
        }
        showToast('X report sent to printer', 'info')
      } else {
        await printZReport(
          printOptions,
          config.default_printer,
          config.default_printer_id,
          config.default_printer_connection,
        )
        if (seriesNo) {
          await markSeriesReportPrinted(seriesNo, config.terminal_name, 'Z')
        }
        showToast('Z report sent to printer', 'info')
      }
      closeReportPrintModal()
    } catch (error) {
      alertMessage('Print failed', error instanceof Error ? error.message : 'Unable to print report.')
    } finally {
      setIsPrintingReport(false)
    }
  }

  async function handleApplyPendingLayout() {
    if (!pendingLayoutPreview) {
      return
    }

    setIsSavingLayout(true)

    try {
      const marginFields = {
        print_margin_left: pendingLayoutPreview.marginLeft,
        print_margin_right: pendingLayoutPreview.marginRight,
        print_margin_top: pendingLayoutPreview.marginTop,
        print_margin_bottom: pendingLayoutPreview.marginBottom,
      }

      if (pendingLayoutPreview.kind === 'test-print') {
        const next: PosConfig = {
          ...activeConfig,
          test_print_layout: pendingLayoutPreview.layoutId,
          ...marginFields,
        }
        await saveConfig(next)
        setConfig(next)
        showToast(`Test print layout: ${pendingLayoutPreview.layoutLabel}`, 'info')
      } else if (pendingLayoutPreview.kind === 'receipt') {
        const next: PosConfig = {
          ...activeConfig,
          receipt_layout: pendingLayoutPreview.layoutId,
          ...marginFields,
        }
        await saveConfig(next)
        setConfig(next)
        showToast(`Receipt layout: ${pendingLayoutPreview.layoutLabel}`, 'info')
      } else if (pendingLayoutPreview.kind === 'x-report') {
        const next: PosConfig = {
          ...activeConfig,
          x_report_layout: pendingLayoutPreview.layoutId,
          ...marginFields,
        }
        await saveConfig(next)
        setConfig(next)
        showToast(`X report layout: ${pendingLayoutPreview.layoutLabel}`, 'info')
      } else {
        const next: PosConfig = {
          ...activeConfig,
          z_report_layout: pendingLayoutPreview.layoutId,
          ...marginFields,
        }
        await saveConfig(next)
        setConfig(next)
        showToast(`Z report layout: ${pendingLayoutPreview.layoutLabel}`, 'info')
      }

      setPendingLayoutPreview(null)
    } catch (error) {
      Alert.alert(
        'Unable to save layout',
        error instanceof Error ? error.message : 'Failed to save print layout.',
      )
    } finally {
      setIsSavingLayout(false)
    }
  }

  async function handleSelectTheme(themeId: ThemeId) {
    if (!config) {
      return
    }
    setIsApplyingTheme(true)
    try {
      const next: PosConfig = { ...config, ui_theme: themeId }
      await saveConfig(next)
      setConfig(next)
      setActiveTheme(themeId)
      showToast(`Theme changed to ${themeOptions.find((item) => item.id === themeId)?.label || themeId}.`, 'info')
      setThemeModalOpen(false)
    } catch (error) {
      Alert.alert('Unable to apply theme', error instanceof Error ? error.message : 'Failed to save theme.')
    } finally {
      setIsApplyingTheme(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        seriesOptions={seriesOptions}
        activeSeriesNo={activeSeriesNo}
        onSelectSeries={selectSeries}
        onCreateSeries={() => setNewSeriesOpen(true)}
        onCloseSeries={async (seriesNo) => {
          await closeSeriesByNo(seriesNo)
          emptyCart()
          setDiscountRate(0)
          setStartingBalanceSaved(true)
        }}
        onGetCloseRequirements={(seriesNo) => getCloseRequirementsBySeriesNo(seriesNo)}
        onGetSeriesSummary={(seriesNo) => {
          if (!config?.terminal_name) {
            throw new Error('Terminal is not configured.')
          }
          return getSummary(config.terminal_name, seriesNo)
        }}
        isClosingSeries={isBusy}
        onXReport={() => void handleOpenXReport()}
        onZReport={() => void handleOpenZReport()}
        onDefaultPrinter={() => {
          setPrinterOpen(true)
        }}
        onTheme={() => setThemeModalOpen(true)}
        onStartingBalance={() => {
          if (activeSeriesNo) {
            setStartingBalanceSeriesNo(activeSeriesNo)
            setStartingBalanceOpen(true)
          }
        }}
        onSalesTransactions={() =>
          navigation.navigate('SalesTransactions', { seriesNo: activeSeriesNo ?? undefined })
        }
        testPrintLayout={testPrintLayout}
        receiptLayout={receiptLayout}
        xReportLayout={xReportLayout}
        zReportLayout={zReportLayout}
        onSelectTestPrintLayout={handleSelectTestPrintLayout}
        onSelectReceiptLayout={handleSelectReceiptLayout}
        onSelectXReportLayout={handleSelectXReportLayout}
        onSelectZReportLayout={handleSelectZReportLayout}
        onReregister={() =>
          void reregisterTerminal({
            navigation,
            logout,
            onConfigCleared: () => setConfig(null),
          })
        }
        onLogout={() => setLogoutConfirmOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onTerminalInformation={() => setTerminalInfoOpen(true)}
        onCashCountSheet={handleOpenCashCountSheet}
      />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch', opacity: canTransact ? 1 : 0.55 }}>
        <View style={{ flex: 1 }} pointerEvents={canTransact ? 'auto' : 'none'}>
          <CartList
            lines={lines}
            disabled={!canTransact}
            onIncrement={(lineId) => void handleIncrementQty(lineId)}
            onDecrement={(lineId) => void handleDecrementQty(lineId)}
            onUpdateQty={(lineId, qty) => void handleUpdateLineQty(lineId, qty)}
            onQtyEditorOpenChange={setIsCartQtyEditorOpen}
            onRemove={handleRemoveRequest}
            onEmptyCart={handleEmptyCartRequest}
            emptyCartDisabled={lines.length === 0}
          />
        </View>
        <RightSummaryPanel
          currentOrnDisplay={currentOrnDisplay}
          terminalName={config.terminal_name}
          barcode={barcode}
          qty={pendingQty}
          totals={totals}
          summary={summary}
          cashierName={user?.fullName || user?.username || 'Cashier'}
          disabled={!canTransact}
          refocusEnabled={!anyModalOpen}
          onBarcodeChange={setBarcode}
          onQtyChange={setPendingQty}
          onScanSubmit={() => void handleScanSubmit()}
          onCheckout={handleCheckoutPress}
          onCustomQty={openCustomQtyModal}
          onDiscount={() => {
            if (canTransact) {
              setDiscountOpen(true)
            }
          }}
          onSearch={() => {
            if (canTransact) {
              setSearchOpen(true)
            }
          }}
        />
      </View>
      <TerminalFooter config={config} />
      <ProductSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={(product) => void addProduct(product)} />
      <CustomQtyModal
        visible={qtyOpen}
        currentQty={pendingQty}
        onClose={() => setQtyOpen(false)}
        onApply={setPendingQty}
      />
      <DiscountModal
        visible={discountOpen}
        currentRate={totals.discountRate}
        onClose={() => setDiscountOpen(false)}
        onApply={setDiscountRate}
      />
      <NewSeriesConfirmModal
        visible={newSeriesOpen}
        isSubmitting={isBusy}
        onConfirm={() => void handleConfirmNewSeries()}
        onCancel={() => setNewSeriesOpen(false)}
      />
      <StartingBalanceModal
        visible={startingBalanceOpen}
        seriesNo={startingBalanceSeriesNo}
        isSubmitting={isSavingStartingBalance}
        onClose={() => setStartingBalanceOpen(false)}
        onConfirm={(amount) => void handleSaveStartingBalance(amount)}
      />
      <CheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      <AboutModal
        visible={aboutOpen}
        branchCode={resolveBranchCode(config)}
        onClose={() => setAboutOpen(false)}
      />
      <TerminalInformationModal
        visible={terminalInfoOpen}
        config={config}
        isPrinting={isPrintingTerminalInfo}
        onClose={() => setTerminalInfoOpen(false)}
        onPrint={(terminal) => void handlePrintTerminalInfo(terminal)}
        onTerminalSynced={(next) => setConfig(next)}
      />
      <CashCountSheetModal
        visible={cashCountOpen}
        config={config}
        activeSeriesNo={activeSeriesNo}
        cashierName={user?.fullName || user?.username || 'Cashier'}
        isPrinting={isPrintingCashCount}
        onClose={() => setCashCountOpen(false)}
        onPrint={(payload) => void handlePrintCashCountSheet(payload)}
      />
      <ReportPrintPreviewModal
        visible={reportPrintKind !== null}
        kind={reportPrintKind ?? 'X'}
        previewText={reportPrintPreviewText}
        report={reportPrintPayload?.report ?? null}
        config={config}
        seriesNo={reportPrintPayload?.seriesNo ?? activeSeriesNo}
        logoUri={logoPreviewEnabled ? printLogoPreview.uri : null}
        logoWidthPercent={logoPreviewEnabled ? printLogoPreview.widthPercent : 0}
        logoAlign={printLogoPreview.align}
        loading={reportPrintLoading}
        error={reportPrintError}
        isPrinting={isPrintingReport}
        onPrint={() => void handlePrintReportFromModal()}
        onClose={closeReportPrintModal}
      />
      <Modal visible={themeModalOpen} transparent animationType="fade" onRequestClose={() => setThemeModalOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 24,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              width: '100%',
              maxWidth: 560,
              maxHeight: '80%',
              padding: 16,
            }}
          >
            <Text style={{ color: colors.text, fontFamily: 'Inter_800ExtraBold', fontSize: 18, marginBottom: 4 }}>
              Select Theme
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              Choose one of 6 themes. Default keeps the current design.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {themeOptions.map((option) => {
                  const palette = themePalettes[option.id]
                  const selected = resolveThemeId(config?.ui_theme) === option.id
                  return (
                    <Pressable
                      key={option.id}
                      disabled={isApplyingTheme}
                      onPress={() => void handleSelectTheme(option.id)}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                        padding: 10,
                        opacity: isApplyingTheme ? 0.65 : 1,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{option.label}</Text>
                        <Text style={{ color: selected ? colors.accent : colors.textMuted, fontSize: 12 }}>
                          {selected ? 'Selected' : 'Apply'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <View style={{ height: 14, flex: 1, borderRadius: 4, backgroundColor: palette.bg }} />
                        <View style={{ height: 14, flex: 1, borderRadius: 4, backgroundColor: palette.surface }} />
                        <View style={{ height: 14, flex: 1, borderRadius: 4, backgroundColor: palette.surfaceAlt }} />
                        <View style={{ height: 14, flex: 1, borderRadius: 4, backgroundColor: palette.accent }} />
                        <View style={{ height: 14, flex: 1, borderRadius: 4, backgroundColor: palette.good }} />
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Pressable onPress={() => setThemeModalOpen(false)} disabled={isApplyingTheme}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter_700Bold' }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <PrintLayoutPreviewModal
        visible={pendingLayoutPreview !== null}
        kind={pendingLayoutPreview?.kind ?? 'test-print'}
        layoutLabel={pendingLayoutPreview?.layoutLabel ?? ''}
        previewText={pendingLayoutPreview?.previewText ?? ''}
        marginLeft={pendingLayoutPreview?.marginLeft ?? savedMarginLeft}
        marginRight={pendingLayoutPreview?.marginRight ?? savedMarginRight}
        marginTop={pendingLayoutPreview?.marginTop ?? savedMarginTop}
        marginBottom={pendingLayoutPreview?.marginBottom ?? savedMarginBottom}
        logoUri={logoPreviewEnabled ? printLogoPreview.uri : null}
        logoWidthPercent={logoPreviewEnabled ? printLogoPreview.widthPercent : 0}
        logoAlign={printLogoPreview.align}
        saving={isSavingLayout}
        onApply={() => void handleApplyPendingLayout()}
        onMarginChange={handlePreviewMarginChange}
        onCancel={() => setPendingLayoutPreview(null)}
      />
      {config ? (
        <DefaultPrinterModal
          visible={printerOpen}
          config={activeConfig}
          onClose={() => setPrinterOpen(false)}
          onSaved={async (next) => {
            await saveConfig(next)
            setConfig(next)
            setPrinterOpen(false)
            showToast('Default printer updated', 'info')
          }}
        />
      ) : null}
      <ConfirmModal
        visible={pendingConfirm?.kind === 'empty-cart'}
        title="Empty cart?"
        message="This will remove all items from the current cart. This action cannot be undone."
        confirmLabel="Empty Cart"
        destructive
        onConfirm={handleConfirmPendingAction}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmModal
        visible={pendingConfirm?.kind === 'remove-line'}
        title="Remove item?"
        message={
          pendingConfirm?.kind === 'remove-line'
            ? `Remove "${pendingConfirm.itemName}" from the cart?`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={handleConfirmPendingAction}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmModal
        visible={logoutConfirmOpen}
        title="Sign out?"
        message="Are you sure you want to log out of this terminal?"
        confirmLabel="Logout"
        destructive
        onConfirm={() => {
          setLogoutConfirmOpen(false)
          clearCashCountDraft()
          void logout().finally(() => navigation.replace('Login'))
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </View>
  )
}
