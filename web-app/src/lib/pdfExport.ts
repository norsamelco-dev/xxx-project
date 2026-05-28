export type PdfPaperSize = 'a4' | 'letter' | 'folio' | 'legal'
export type PdfOrientation = 'portrait' | 'landscape'

export type PdfExportOptions = {
  paperSize: PdfPaperSize
  orientation: PdfOrientation
}

export type JsPdfDocument = import('jspdf').jsPDF

export const PDF_PAPER_SIZE_OPTIONS: Array<{
  value: PdfPaperSize
  label: string
  sizeInches: string
  widthIn: number
  heightIn: number
}> = [
  { value: 'a4', label: 'A4', sizeInches: '8.27 × 11.69 in', widthIn: 8.27, heightIn: 11.69 },
  { value: 'letter', label: 'Letter', sizeInches: '8.50 × 11.00 in', widthIn: 8.5, heightIn: 11 },
  { value: 'folio', label: 'Folio', sizeInches: '8.50 × 13.00 in', widthIn: 8.5, heightIn: 13 },
  { value: 'legal', label: 'Legal', sizeInches: '8.50 × 14.00 in', widthIn: 8.5, heightIn: 14 },
]

export function createPdfDocument(
  JsPDF: new (options?: object) => JsPdfDocument,
  paperSize: PdfPaperSize,
  orientation: PdfOrientation,
) {
  const option = PDF_PAPER_SIZE_OPTIONS.find((item) => item.value === paperSize) || PDF_PAPER_SIZE_OPTIONS[0]
  let widthPt = option.widthIn * 72
  let heightPt = option.heightIn * 72

  if (orientation === 'landscape') {
    ;[widthPt, heightPt] = [heightPt, widthPt]
  }

  return new JsPDF({
    orientation,
    unit: 'pt',
    format: [widthPt, heightPt],
  })
}

export function formatPdfExportLabel(options: PdfExportOptions) {
  const paper = PDF_PAPER_SIZE_OPTIONS.find((item) => item.value === options.paperSize)
  const paperLabel = paper?.label || options.paperSize
  return `${paperLabel}, ${options.orientation}`
}

export function toPdfImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG'
  }

  if (dataUrl.startsWith('data:image/webp')) {
    return 'WEBP'
  }

  return 'PNG'
}

function toBlobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image data.'))
    }

    reader.onerror = () => {
      reject(new Error('Unable to read image data.'))
    }

    reader.readAsDataURL(blob)
  })
}

export async function loadPdfImageDataUrl(imagePath: string): Promise<string> {
  const response = await fetch(imagePath, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Unable to load business logo for export.')
  }

  const blob = await response.blob()
  return toBlobDataUrl(blob)
}

export type ReceiptHeadingPublic = {
  busi_name: string | null
  busi_addr: string | null
  busi_owner: string | null
  busi_tin: string | null
  business_logo_path: string | null
}

export async function drawPdfBusinessHeader(
  doc: JsPdfDocument,
  receiptHeading: ReceiptHeadingPublic | null,
  leftMargin = 36,
  headerTop = 32,
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let contentStartX = leftMargin

  if (receiptHeading?.business_logo_path) {
    try {
      const logoDataUrl = await loadPdfImageDataUrl(receiptHeading.business_logo_path)
      const logoFormat = toPdfImageFormat(logoDataUrl)
      doc.addImage(logoDataUrl, logoFormat, leftMargin, headerTop, 54, 54)
      contentStartX = leftMargin + 64
    } catch (_logoError) {
      // Continue export when logo is unavailable.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(receiptHeading?.busi_name || 'Business Name', contentStartX, headerTop + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(receiptHeading?.busi_addr || 'Business address unavailable', contentStartX, headerTop + 30)
  doc.text(`Owner: ${receiptHeading?.busi_owner || '-'}`, contentStartX, headerTop + 44)
  doc.text(`TIN: ${receiptHeading?.busi_tin || '-'}`, contentStartX, headerTop + 58)

  doc.setDrawColor(214, 220, 228)
  doc.line(leftMargin, headerTop + 66, pageWidth - leftMargin, headerTop + 66)

  return headerTop + 78
}

export function addPdfPageNumbers(doc: JsPdfDocument, leftMargin = 36) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const totalPages = doc.getNumberOfPages()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - leftMargin, pageHeight - 18, { align: 'right' })
  }
}
