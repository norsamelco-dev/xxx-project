import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import PdfExportSettingsModal from '../components/PdfExportSettingsModal'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription, recordAuditEvent, type AuditMeta } from '../lib/audit'
import {
  addPdfPageNumbers,
  createPdfDocument,
  drawPdfBusinessHeader,
  formatPdfExportLabel,
  type JsPdfDocument,
  type PdfExportOptions,
  type PdfOrientation,
  type PdfPaperSize,
  type ReceiptHeadingPublic,
} from '../lib/pdfExport'

type SalesSeriesRow = {
  ID: number
  created_at: string | null
  full_series_no: string | null
  machine_id: string | null
  min_number: string | null
  ptu: string | null
  seriesno: number | null
  starting_balance: number | string | null
  totalsales: number | string | null
  vat_amount: number | string | null
  grand_total: number | string | null
  userid: number | null
  username: string | null
  lockbatch: string | null
  transaction_count: number | string | null
  first_orsi: number | string | null
  last_orsi: number | string | null
}

type SalesTransactionRow = {
  ID: number
  created_at: string | null
  sales_series_no: string | null
  MachineName: string | null
  PTU: string | null
  ORSI: number
  sales_amt: number | string | null
  discountrate: number | string | null
  discount_amount: number | string | null
  sales_vatable_amount: number | string | null
  sales_vat_rate: number | string | null
  sales_total_amt: number | string | null
  sales_grandtotal: number | string | null
  amt_tendered: number | string | null
  amt_change: number | string | null
  payment_method: string | null
  payment_ref_no: string | null
  total_item_sold: number | string | null
  customerid: number | null
  userid: number | null
  username: string | null
  VOIDED: string | null
  VOID_REASON: string | null
  line_item_count: number | string | null
}

type SalesItemRow = {
  ID: number
  created_at: string | null
  sales_series_no: string | null
  ORSI: number
  CATEGORY: string | null
  BATCHID: string | null
  BARCODE: string | null
  DESCRIPTION: string | null
  BRAND: string | null
  UNIT: string | null
  QTY: number | string | null
  PRICE: number | string | null
  TOTAL: number | string | null
  VOIDED: string | null
}

type SalesSeriesResponse = {
  data: SalesSeriesRow[]
  filters?: {
    start_date: string | null
    end_date: string | null
    search: string | null
  }
}

type SalesTransactionsResponse = {
  data: SalesTransactionRow[]
  series_no: string
}

type SalesItemsResponse = {
  data: SalesItemRow[]
  orsi: number
}

function toDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

function toNumber(value: number | string | null) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return 0
  }

  return parsed
}

function toMoney(value: number | string | null) {
  return `₱ ${toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function toPdfMoney(value: number | string | null) {
  return `PHP ${toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function toInvoiceRange(firstOrsi: number | string | null, lastOrsi: number | string | null) {
  const first = Number(firstOrsi)
  const last = Number(lastOrsi)

  if (Number.isNaN(first) || Number.isNaN(last)) {
    return '-'
  }

  if (first === last) {
    return String(first)
  }

  return `${first} - ${last}`
}

function isVoided(value: string | null) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'Y' || normalized === 'YES' || normalized === '1'
}

function toCurrentLocalDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type PdfExportTarget =
  | { kind: 'report' }
  | { kind: 'breakdown'; series: SalesSeriesRow }

function drawPdfSummaryTotals(
  doc: JsPdfDocument,
  pageWidth: number,
  leftMargin: number,
  finalY: number,
  totals: { totalSales: number; vat: number; grandTotal: number },
) {
  const boxWidth = pageWidth - leftMargin * 2

  doc.setFillColor(245, 247, 250)
  doc.roundedRect(leftMargin, finalY + 8, boxWidth, 34, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)

  const labelY = finalY + 30
  doc.text(`Total Sales: ${toPdfMoney(totals.totalSales)}`, leftMargin + 12, labelY)
  doc.text(`VAT: ${toPdfMoney(totals.vat)}`, leftMargin + boxWidth * 0.38, labelY)
  doc.text(`Grand Total: ${toPdfMoney(totals.grandTotal)}`, leftMargin + boxWidth * 0.72, labelY)
}

function SalesReportPage() {
  usePageVisitAudit(AUDIT_PAGES.SALES_REPORT)
  const [startDate, setStartDate] = useState(() => toCurrentLocalDateInputValue())
  const [endDate, setEndDate] = useState(() => toCurrentLocalDateInputValue())
  const [searchText, setSearchText] = useState('')

  const [seriesRows, setSeriesRows] = useState<SalesSeriesRow[]>([])
  const [transactionsBySeries, setTransactionsBySeries] = useState<Record<string, SalesTransactionRow[]>>({})
  const [itemsByOrsi, setItemsByOrsi] = useState<Record<number, SalesItemRow[]>>({})

  const [expandedSeriesNos, setExpandedSeriesNos] = useState<string[]>([])
  const [expandedOrsis, setExpandedOrsis] = useState<number[]>([])

  const [loadingTransactionsBySeries, setLoadingTransactionsBySeries] = useState<Record<string, boolean>>({})
  const [loadingItemsByOrsi, setLoadingItemsByOrsi] = useState<Record<number, boolean>>({})

  const [receiptHeading, setReceiptHeading] = useState<ReceiptHeadingPublic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const [pdfExportTarget, setPdfExportTarget] = useState<PdfExportTarget | null>(null)
  const [pdfPaperSize, setPdfPaperSize] = useState<PdfPaperSize>('a4')
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('landscape')

  const summary = useMemo(() => {
    return seriesRows.reduce(
      (accumulator, row) => {
        accumulator.totalSales += toNumber(row.totalsales)
        accumulator.vat += toNumber(row.vat_amount)
        accumulator.grandTotal += toNumber(row.grand_total)
        return accumulator
      },
      { totalSales: 0, vat: 0, grandTotal: 0 },
    )
  }, [seriesRows])

  useEffect(() => {
    void loadReceiptHeadingPublic()
    void loadSeries({
      nextStartDate: startDate,
      nextEndDate: endDate,
      nextSearchText: searchText,
    })
  }, [])

  async function loadReceiptHeadingPublic() {
    try {
      const response = await apiFetch<{ data: ReceiptHeadingPublic | null }>('/api/receipt-heading/public')
      setReceiptHeading(response.data)
    } catch (_error) {
      setReceiptHeading(null)
    }
  }

  async function loadSeries({
    nextStartDate,
    nextEndDate,
    nextSearchText,
    audit,
  }: {
    nextStartDate: string
    nextEndDate: string
    nextSearchText: string
    audit?: AuditMeta
  }) {
    try {
      setError('')
      setIsLoading(true)

      const params = new URLSearchParams()
      if (nextStartDate) {
        params.set('start_date', nextStartDate)
      }
      if (nextEndDate) {
        params.set('end_date', nextEndDate)
      }
      if (nextSearchText.trim()) {
        params.set('search', nextSearchText.trim())
      }

      const queryString = params.toString()
      const endpoint = queryString ? `/api/sales/series?${queryString}` : '/api/sales/series'
      const response = await apiFetch<SalesSeriesResponse>(endpoint, { audit })

      setSeriesRows(response.data || [])
      setExpandedSeriesNos([])
      setExpandedOrsis([])
      setTransactionsBySeries({})
      setItemsByOrsi({})
      setLoadingTransactionsBySeries({})
      setLoadingItemsByOrsi({})

      if (response.filters?.start_date) {
        setStartDate(response.filters.start_date)
      }

      if (response.filters?.end_date) {
        setEndDate(response.filters.end_date)
      }

      if (response.filters?.search !== undefined && response.filters?.search !== null) {
        setSearchText(response.filters.search)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sales series.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadItems(orsi: number) {
    if (!orsi) {
      return
    }

    try {
      setError('')
      setLoadingItemsByOrsi((current) => ({ ...current, [orsi]: true }))

      const response = await apiFetch<SalesItemsResponse>(`/api/sales/transactions/${orsi}/items`)

      setItemsByOrsi((current) => ({
        ...current,
        [orsi]: response.data || [],
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sales line items.')
    } finally {
      setLoadingItemsByOrsi((current) => ({ ...current, [orsi]: false }))
    }
  }

  function toggleTransaction(orsi: number) {
    if (!orsi) {
      return
    }

    const isExpanded = expandedOrsis.includes(orsi)

    if (isExpanded) {
      setExpandedOrsis((current) => current.filter((value) => value !== orsi))
      return
    }

    setExpandedOrsis((current) => [...current, orsi])

    if (!itemsByOrsi[orsi]) {
      void loadItems(orsi)
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadSeries({
      nextStartDate: startDate,
      nextEndDate: endDate,
      nextSearchText: searchText,
      audit: {
        page: AUDIT_PAGES.SALES_REPORT,
        action: 'GENERATE REPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.SALES_REPORT,
          `Generated sales report from ${startDate} to ${endDate}${searchText.trim() ? ` with search "${searchText.trim()}"` : ''}.`,
        ),
        tableName: 'sales',
      },
    })
  }

  async function handleExportPdf(exportOptions: PdfExportOptions) {
    if (seriesRows.length === 0) {
      setError('No sales data available to export.')
      return
    }

    try {
      setError('')
      setIsExporting(true)

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = createPdfDocument(jsPDF, exportOptions.paperSize, exportOptions.orientation)

      const pageWidth = doc.internal.pageSize.getWidth()
      const leftMargin = 36
      const reportTitleY = await drawPdfBusinessHeader(doc, receiptHeading, leftMargin)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Sales Report', pageWidth / 2, reportTitleY, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const rangeLabel = startDate || endDate
        ? `${startDate || '-'} to ${endDate || '-'}`
        : 'All available dates'
      doc.text(`Date Range: ${rangeLabel}`, pageWidth / 2, reportTitleY + 16, { align: 'center' })

      autoTable(doc, {
        startY: reportTitleY + 32,
        head: [[
          'Series No / Date',
          'Cashier / Machine / PTU',
          'Trans',
          'Invoice',
          'Total Sales',
          'VAT',
          'Grand Total',
        ]],
        body: seriesRows.map((series) => {
          const seriesNo = String(series.full_series_no || '-')

          return [
            `${seriesNo}\n${toDateTime(series.created_at)}`,
            `${series.username || '-'}\n${series.machine_id || '-'}\n${series.ptu || '-'}`,
            String(toNumber(series.transaction_count)),
            toInvoiceRange(series.first_orsi, series.last_orsi),
            toPdfMoney(series.totalsales),
            toPdfMoney(series.vat_amount),
            toPdfMoney(series.grand_total),
          ]
        }),
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          valign: 'middle',
          lineColor: [224, 229, 236],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 251, 253],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
      })

      const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || reportTitleY + 40
      drawPdfSummaryTotals(doc, pageWidth, leftMargin, finalY, summary)

      addPdfPageNumbers(doc, leftMargin)

      const fileDate = new Date().toISOString().slice(0, 10)
      doc.save(`sales-report-${fileDate}.pdf`)

      await recordAuditEvent({
        page: AUDIT_PAGES.SALES_REPORT,
        action: 'EXPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.SALES_REPORT,
          `Exported sales report PDF from ${startDate} to ${endDate} (${formatPdfExportLabel(exportOptions)}).`,
        ),
        tableName: 'sales',
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export PDF report.')
    } finally {
      setIsExporting(false)
    }
  }

  function openPdfExportModal(target: PdfExportTarget) {
    setError('')

    if (target.kind === 'breakdown') {
      setPdfPaperSize('a4')
      setPdfOrientation('portrait')
    }

    setPdfExportTarget(target)
  }

  function closePdfExportModal() {
    if (isExporting) {
      return
    }

    setPdfExportTarget(null)
  }

  async function handleConfirmPdfExport() {
    if (!pdfExportTarget) {
      return
    }

    const exportOptions: PdfExportOptions = {
      paperSize: pdfPaperSize,
      orientation: pdfOrientation,
    }
    const target = pdfExportTarget

    setPdfExportTarget(null)

    if (target.kind === 'report') {
      await handleExportPdf(exportOptions)
      return
    }

    await handleExportBreakdown(target.series, exportOptions)
  }

  async function handleExportBreakdown(targetSeries: SalesSeriesRow, exportOptions: PdfExportOptions) {
    const exportSeriesRows = [targetSeries]

    const exportSummary = exportSeriesRows.reduce(
      (accumulator, row) => {
        accumulator.totalSales += toNumber(row.totalsales)
        accumulator.vat += toNumber(row.vat_amount)
        accumulator.grandTotal += toNumber(row.grand_total)
        return accumulator
      },
      { totalSales: 0, vat: 0, grandTotal: 0 },
    )

    try {
      setError('')
      setIsExporting(true)

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = createPdfDocument(jsPDF, exportOptions.paperSize, exportOptions.orientation)

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const leftMargin = 36
      const reportTitleY = await drawPdfBusinessHeader(doc, receiptHeading, leftMargin)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Sales Series No. Breakdown Report', pageWidth / 2, reportTitleY, { align: 'center' })

      autoTable(doc, {
        startY: reportTitleY + 24,
        head: [[
          'Series No / Date',
          'Cashier / Machine / PTU',
          'Trans',
          'Invoice',
          'Total Sales',
          'VAT',
          'Grand Total',
        ]],
        body: exportSeriesRows.map((series) => {
          const seriesNo = String(series.full_series_no || '-')

          return [
            `${seriesNo}\n${toDateTime(series.created_at)}`,
            `${series.username || '-'}\n${series.machine_id || '-'}\n${series.ptu || '-'}`,
            String(toNumber(series.transaction_count)),
            toInvoiceRange(series.first_orsi, series.last_orsi),
            toPdfMoney(series.totalsales),
            toPdfMoney(series.vat_amount),
            toPdfMoney(series.grand_total),
          ]
        }),
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          valign: 'middle',
          lineColor: [224, 229, 236],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 251, 253],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
      })

      const seriesTransactionsMap: Record<string, SalesTransactionRow[]> = {}
      const transactionItemsMap: Record<number, SalesItemRow[]> = {}

      for (const series of exportSeriesRows) {
        const seriesNo = String(series.full_series_no || '')
        if (!seriesNo) {
          continue
        }

        try {
          const transactionResponse = await apiFetch<SalesTransactionsResponse>(
            `/api/sales/series/${encodeURIComponent(seriesNo)}/transactions`,
          )

          const transactions = transactionResponse.data || []
          seriesTransactionsMap[seriesNo] = transactions

          for (const transaction of transactions) {
            try {
              const itemsResponse = await apiFetch<SalesItemsResponse>(`/api/sales/transactions/${transaction.ORSI}/items`)
              transactionItemsMap[transaction.ORSI] = itemsResponse.data || []
            } catch (_itemsError) {
              transactionItemsMap[transaction.ORSI] = []
            }
          }
        } catch (_transactionsError) {
          seriesTransactionsMap[seriesNo] = []
        }
      }

      for (const series of exportSeriesRows) {
        const seriesNo = String(series.full_series_no || '')
        if (!seriesNo) {
          continue
        }

        const transactions = seriesTransactionsMap[seriesNo] || []
        const baseY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || reportTitleY + 40

        if (baseY > pageHeight - 120) {
          doc.addPage()
        } else {
          const dividerY = baseY + 16
          doc.setDrawColor(214, 220, 228)
          doc.line(leftMargin, dividerY, pageWidth - leftMargin, dividerY)
        }

        const sectionY = ((doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || reportTitleY + 40) + 12

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(`Sales A Breakdown - Series ${seriesNo}`, leftMargin, sectionY)

        if (transactions.length === 0) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text('No sales_a records found for this series.', leftMargin, sectionY + 14)
          continue
        }

        const transactionComputationStatuses = transactions.map((transaction) => {
          const transactionVoided = isVoided(transaction.VOIDED)
          const items = transactionItemsMap[transaction.ORSI] || []
          const hasItems = items.length > 0
          const hasNonVoidedItems = items.some((item) => !isVoided(item.VOIDED))

          if (transactionVoided) {
            return {
              excluded: true,
              label: 'VOIDED SALES_A - EXCLUDED FROM COMPUTATION',
            }
          }

          if (!hasItems) {
            return {
              excluded: true,
              label: 'EXCLUDED - NO SALES_B ITEMS',
            }
          }

          if (!hasNonVoidedItems) {
            return {
              excluded: true,
              label: 'EXCLUDED - ALL SALES_B ITEMS VOIDED',
            }
          }

          return {
            excluded: false,
            label: 'INCLUDED IN COMPUTATION',
          }
        })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(153, 27, 27)
        doc.text('Note: Computation excludes VOIDED sales_a and sales_b records.', leftMargin, sectionY + 14)
        doc.setTextColor(15, 23, 42)

        autoTable(doc, {
          startY: sectionY + 20,
          head: [[
            'Created At',
            'ORSI',
            'Payment',
            'Cashier',
            'Items',
            'Computation',
            'Grand Total',
          ]],
          body: transactions.map((transaction, index) => {
            const computation = transactionComputationStatuses[index]

            return [
              toDateTime(transaction.created_at),
              String(transaction.ORSI),
              transaction.payment_method || '-',
              transaction.username || '-',
              String(toNumber(transaction.line_item_count)),
              computation.label,
              toPdfMoney(transaction.sales_grandtotal),
            ]
          }),
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 4,
            valign: 'middle',
            lineColor: [224, 229, 236],
            lineWidth: 0.5,
          },
          headStyles: {
            fillColor: [55, 65, 81],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [249, 251, 253],
          },
          columnStyles: {
            1: { halign: 'center' },
            4: { halign: 'right' },
            6: { halign: 'right' },
          },
          didParseCell: (data) => {
            if (data.section !== 'body') {
              return
            }

            if (transactionComputationStatuses[data.row.index]?.excluded) {
              data.cell.styles.fillColor = [254, 226, 226]
              data.cell.styles.textColor = [153, 27, 27]

              if (data.column.index === 5) {
                data.cell.styles.fontStyle = 'bold'
              }
            }
          },
        })

        for (const transaction of transactions) {
          const items = transactionItemsMap[transaction.ORSI] || []
          const transactionY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || sectionY + 20

          if (transactionY > pageHeight - 100) {
            doc.addPage()
          } else {
            const dividerY = transactionY + 10
            doc.setDrawColor(214, 220, 228)
            doc.line(leftMargin, dividerY, pageWidth - leftMargin, dividerY)
          }

          const itemsStartY = ((doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || sectionY + 20) + 12

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text(`Sales B Breakdown - ORSI ${transaction.ORSI}`, leftMargin, itemsStartY)

          if (items.length === 0) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.text('No sales_b records found for this transaction.', leftMargin, itemsStartY + 14)
            continue
          }

          const itemVoidedFlags = items.map((item) => isVoided(item.VOIDED))

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(153, 27, 27)
          doc.text('Note: VOIDED sales_b items are excluded from summary computation.', leftMargin, itemsStartY + 14)
          doc.setTextColor(15, 23, 42)

          autoTable(doc, {
            startY: itemsStartY + 18,
            head: [[
              'Description / Barcode',
              'Category',
              'Brand',
              'Qty',
              'Unit',
              'Price',
              'Total',
              'Status',
            ]],
            body: items.map((item) => [
              `${item.DESCRIPTION || '-'}\n${item.BARCODE || '-'}`,
              item.CATEGORY || '-',
              item.BRAND || '-',
              String(toNumber(item.QTY)),
              item.UNIT || '-',
              toPdfMoney(item.PRICE),
              toPdfMoney(item.TOTAL),
              isVoided(item.VOIDED) ? 'VOIDED' : '-',
            ]),
            theme: 'grid',
            styles: {
              fontSize: 7.5,
              cellPadding: 3,
              valign: 'middle',
              lineColor: [224, 229, 236],
              lineWidth: 0.5,
            },
            headStyles: {
              fillColor: [75, 85, 99],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
            },
            alternateRowStyles: {
              fillColor: [249, 251, 253],
            },
            columnStyles: {
              3: { halign: 'right' },
              5: { halign: 'right' },
              6: { halign: 'right' },
            },
            didParseCell: (data) => {
              if (data.section !== 'body') {
                return
              }

              if (itemVoidedFlags[data.row.index]) {
                data.cell.styles.fillColor = [254, 226, 226]
                data.cell.styles.textColor = [153, 27, 27]

                if (data.column.index === 7) {
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            },
          })
        }
      }

      const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || reportTitleY + 40
      drawPdfSummaryTotals(doc, pageWidth, leftMargin, finalY, exportSummary)

      addPdfPageNumbers(doc, leftMargin)

      const fileDate = new Date().toISOString().slice(0, 10)
      const suffix = targetSeries?.full_series_no ? `-${String(targetSeries.full_series_no).replace(/[^a-zA-Z0-9_-]/g, '_')}` : ''
      doc.save(`sales-report-breakdown${suffix}-${fileDate}.pdf`)

      await recordAuditEvent({
        page: AUDIT_PAGES.SALES_REPORT,
        action: 'EXPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.SALES_REPORT,
          `Exported sales breakdown PDF for series ${targetSeries.full_series_no || 'N/A'} (${formatPdfExportLabel(exportOptions)}).`,
        ),
        tableName: 'sales',
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export PDF report.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AdminShell title="Sales Report" description="Sales hierarchy report from sales_series to sales_a and sales_b." hideTopbar>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Sales Report</p>
              <h1 className="audit-card-title">Sales Report</h1>
              <p className="audit-card-description">Main table: sales_series. Breakdown: sales_a. Item breakdown: sales_b.</p>
            </div>

            <div className="audit-card-actions">
              <button
                className="topbar-button topbar-button--ghost"
                type="button"
                onClick={() => openPdfExportModal({ kind: 'report' })}
                disabled={isLoading || isExporting || seriesRows.length === 0}
              >
                <ButtonLabel icon="export">Export to PDF</ButtonLabel>
              </button>
              <button
                className="topbar-button topbar-button--ghost"
                type="button"
                onClick={() =>
                  void loadSeries({
                    nextStartDate: startDate,
                    nextEndDate: endDate,
                    nextSearchText: searchText,
                  })
                }
              >
                <ButtonLabel icon="reload">Reload</ButtonLabel>
              </button>
            </div>
          </div>

          <form className="sales-filter-bar" onSubmit={handleGenerate}>
            <div className="field">
              <label htmlFor="sales_start_date">From</label>
              <input
                id="sales_start_date"
                name="sales_start_date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="sales_end_date">To</label>
              <input
                id="sales_end_date"
                name="sales_end_date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="sales_search">Search</label>
              <input
                id="sales_search"
                name="sales_search"
                type="search"
                placeholder="Search series, machine, cashier"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>

            <ThemedButton variant="primary" type="submit" disabled={isLoading}>
              <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
            </ThemedButton>
          </form>

          {isLoading ? <div className="empty-state">Loading sales series...</div> : null}
          {!isLoading && seriesRows.length === 0 ? <div className="empty-state">No sales series found for the selected range.</div> : null}

          {!isLoading && seriesRows.length > 0 ? (
            <>
            <ThemedDataGrid variant="sales">
              <table>
                <thead>
                  <tr>
                    <th>Series No / Date</th>
                    <th>Cashier / Machine / PTU</th>
                    <th>Trans</th>
                    <th>Invoice</th>
                    <th>Starting Balance</th>
                    <th>Total Sales</th>
                    <th>VAT</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesRows.map((series) => {
                    const seriesNo = String(series.full_series_no || '')
                    return (
                      <tr key={series.ID} className="sales-series-row">
                        <td>
                          <div><strong>{seriesNo || '-'}</strong></div>
                          <div>{toDateTime(series.created_at)}</div>
                        </td>
                        <td>
                          <div><strong>{series.machine_id || '-'}</strong></div>
                          <div>{series.ptu || '-'}</div>
                          <div>{series.username || '-'}</div>
                        </td>
                        <td>{toNumber(series.transaction_count)}</td>
                        <td>{toInvoiceRange(series.first_orsi, series.last_orsi)}</td>
                        <td>{toMoney(series.starting_balance)}</td>
                        <td>{toMoney(series.totalsales)}</td>
                        <td>{toMoney(series.vat_amount)}</td>
                        <td>{toMoney(series.grand_total)}</td>
                        <td>
                          <span className={`sales-lock-pill ${String(series.lockbatch || '').toUpperCase() === 'Y' ? 'locked' : 'open'}`}>
                            {String(series.lockbatch || '').toUpperCase() === 'Y' ? 'Locked' : 'Open'}
                          </span>
                        </td>
                        <td>
                          <button className="terminal-action" type="button" onClick={() => openPdfExportModal({ kind: 'breakdown', series })}>
                            <ButtonLabel icon="export">Export Breakdown</ButtonLabel>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ThemedDataGrid>

              {seriesRows.map((series) => {
                const seriesNo = String(series.full_series_no || '')
                const isExpandedSeries = expandedSeriesNos.includes(seriesNo)

                if (!isExpandedSeries) {
                  return null
                }

                const transactions = transactionsBySeries[seriesNo] || []
                const isLoadingTransactions = Boolean(loadingTransactionsBySeries[seriesNo])

                return (
                  <div key={`series-${series.ID}`} className="sales-nested-panel">
                    <div className="sales-nested-header">
                      <h3>Sales A Breakdown for {seriesNo || '-'}</h3>
                    </div>

                    {isLoadingTransactions ? <div className="empty-state">Loading sales_a transactions...</div> : null}
                    {!isLoadingTransactions && transactions.length === 0 ? (
                      <div className="empty-state">No sales_a records found for this sales_series entry.</div>
                    ) : null}

                    {!isLoadingTransactions && transactions.length > 0 ? (
                      <div className="sales-nested-table-wrap">
                        <table className="data-table data-table--sales-nested">
                          <thead>
                            <tr>
                              <th>Created At</th>
                              <th>ORSI</th>
                              <th>Payment</th>
                              <th>Cashier</th>
                              <th>Items</th>
                              <th>Status</th>
                              <th>Grand Total</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction) => {
                              const isExpandedTransaction = expandedOrsis.includes(transaction.ORSI)
                              const items = itemsByOrsi[transaction.ORSI] || []
                              const isLoadingItems = Boolean(loadingItemsByOrsi[transaction.ORSI])
                              const voided = isVoided(transaction.VOIDED)

                              return (
                                <Fragment key={transaction.ID}>
                                  <tr className={voided ? 'terminal-row-duplicate' : ''}>
                                    <td>{toDateTime(transaction.created_at)}</td>
                                    <td>{transaction.ORSI}</td>
                                    <td>{transaction.payment_method || '-'}</td>
                                    <td>{transaction.username || '-'}</td>
                                    <td>{toNumber(transaction.line_item_count)}</td>
                                    <td>
                                      <span className={voided ? 'sales-void-pill' : 'sales-lock-pill open'}>
                                        {voided ? 'VOIDED' : 'ACTIVE'}
                                      </span>
                                    </td>
                                    <td>{toMoney(transaction.sales_grandtotal)}</td>
                                    <td>
                                      <button className="terminal-action" type="button" onClick={() => toggleTransaction(transaction.ORSI)}>
                                        <ButtonLabel icon={isExpandedTransaction ? 'hide' : 'view'}>
                                          {isExpandedTransaction ? 'Hide Sales B' : 'View Sales B'}
                                        </ButtonLabel>
                                      </button>
                                    </td>
                                  </tr>

                                  {isExpandedTransaction ? (
                                    <tr>
                                      <td colSpan={8} className="sales-items-cell">
                                        {isLoadingItems ? <div className="empty-state">Loading sales_b items...</div> : null}
                                        {!isLoadingItems && items.length === 0 ? (
                                          <div className="empty-state">No sales_b records found for this sales_a entry.</div>
                                        ) : null}

                                        {!isLoadingItems && items.length > 0 ? (
                                          <div className="sales-items-wrap">
                                            <table className="data-table data-table--sales-items">
                                              <thead>
                                                <tr>
                                                  <th>Item</th>
                                                  <th>Category</th>
                                                  <th>Brand</th>
                                                  <th>Qty</th>
                                                  <th>Unit</th>
                                                  <th>Price</th>
                                                  <th>Total</th>
                                                  <th>Status</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {items.map((item) => (
                                                  <tr key={item.ID} className={isVoided(item.VOIDED) ? 'terminal-row-duplicate' : ''}>
                                                    <td>
                                                      <div><strong>{item.DESCRIPTION || '-'}</strong></div>
                                                      <div>{item.BARCODE || '-'}</div>
                                                    </td>
                                                    <td>{item.CATEGORY || '-'}</td>
                                                    <td>{item.BRAND || '-'}</td>
                                                    <td>{toNumber(item.QTY)}</td>
                                                    <td>{item.UNIT || '-'}</td>
                                                    <td>{toMoney(item.PRICE)}</td>
                                                    <td>{toMoney(item.TOTAL)}</td>
                                                    <td>{isVoided(item.VOIDED) ? 'VOIDED' : '-'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : null}
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </>
          ) : null}
        </article>

        <div className="summary-grid">
          <article className="summary-card">
            <div>
              <span className="summary-label">Total Sales</span>
              <strong>{toMoney(summary.totalSales)}</strong>
            </div>
            <p>Computed from non-voided sales_b totals (only rows where sales_a.VOIDED and sales_b.VOIDED are not Y).</p>
          </article>

          <article className="summary-card">
            <div>
              <span className="summary-label">VAT</span>
              <strong>{toMoney(summary.vat)}</strong>
            </div>
            <p>Computed from non-voided sales_b using the transaction VAT rate, excluding rows marked VOIDED in sales_a or sales_b.</p>
          </article>

          <article className="summary-card">
            <div>
              <span className="summary-label">Grand Total</span>
              <strong>{toMoney(summary.grandTotal)}</strong>
            </div>
            <p>Computed from non-voided sales_b grand totals after applying the sales_a and sales_b VOIDED filters.</p>
          </article>
        </div>
      </section>

      {pdfExportTarget ? (
        <PdfExportSettingsModal
          title={pdfExportTarget.kind === 'report' ? 'Export Sales Report PDF' : 'Export Breakdown PDF'}
          description={
            pdfExportTarget.kind === 'breakdown'
              ? `Choose the paper size and orientation before generating the PDF. Series: ${pdfExportTarget.series.full_series_no || 'N/A'}`
              : 'Choose the paper size and orientation before generating the PDF.'
          }
          paperSize={pdfPaperSize}
          orientation={pdfOrientation}
          isExporting={isExporting}
          onPaperSizeChange={setPdfPaperSize}
          onOrientationChange={setPdfOrientation}
          onCancel={closePdfExportModal}
          onConfirm={() => void handleConfirmPdfExport()}
        />
      ) : null}
    </AdminShell>
  )
}

export default SalesReportPage
