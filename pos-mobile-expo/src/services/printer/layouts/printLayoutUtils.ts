export const RECEIPT_WIDTH = 42

export function centerText(text: string, width = RECEIPT_WIDTH) {
  const trimmed = text.slice(0, width)
  return trimmed.padStart(Math.floor((width + trimmed.length) / 2))
}

export function clipLine(text: string, width = RECEIPT_WIDTH) {
  return text.slice(0, width)
}

export function divider(width = RECEIPT_WIDTH) {
  return '-'.repeat(width)
}

export function line(columns: string[], widths: number[]) {
  return columns
    .map((value, index) => {
      const columnWidth = widths[index]
      const text = String(value)
      return text.length > columnWidth ? text.slice(0, columnWidth) : text.padEnd(columnWidth, ' ')
    })
    .join('')
}

export function formatPrintTimestamp() {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function normalizeLeftMargin(value?: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(12, Math.floor(value as number)))
}

export function normalizeVerticalMargin(value?: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(20, Math.floor(value as number)))
}

export function applyPrintMarginsToText(
  text: string,
  margins?: { left?: number; right?: number; top?: number; bottom?: number },
  width = RECEIPT_WIDTH,
) {
  const left = normalizeLeftMargin(margins?.left)
  const right = normalizeLeftMargin(margins?.right)
  const top = normalizeVerticalMargin(margins?.top)
  const bottom = normalizeVerticalMargin(margins?.bottom)
  const bodyWidth = Math.max(1, width - left - right)
  const prefix = ' '.repeat(left)

  const rows = text.split('\n').map((row) => `${prefix}${row.slice(0, bodyWidth)}`.slice(0, width))
  return [...Array(top).fill(''), ...rows, ...Array(bottom).fill('')].join('\n')
}

/** Feed lines + GS V partial cut (ESC/POS) for 80mm thermal printers. */
export function appendEscPosAutoCut(text: string, feedLines = 4) {
  const feed = '\n'.repeat(Math.max(1, feedLines))
  return `${text}${feed}\x1D\x56\x01`
}

export function doubleDivider(width = RECEIPT_WIDTH) {
  return '='.repeat(width)
}

export function labelValue(label: string, value: string, width = RECEIPT_WIDTH) {
  return labelValueLines(label, value, width)[0] ?? clipLine(label, width)
}

/** Wrap label + value across multiple lines instead of truncating. */
export function labelValueLines(label: string, value: string, width = RECEIPT_WIDTH): string[] {
  const safeValue = String(value ?? '').trim()
  if (!safeValue) {
    return [clipLine(label, width)]
  }

  const combined = `${label}${safeValue}`
  if (combined.length <= width) {
    return [combined]
  }

  const lines: string[] = []
  let remaining = safeValue
  let isFirst = true

  while (remaining.length > 0 || isFirst) {
    const prefix = isFirst ? label : ' '.repeat(Math.min(label.length, width))
    const capacity = Math.max(1, width - prefix.length)

    if (remaining.length <= capacity) {
      lines.push(clipLine(`${prefix}${remaining}`, width))
      break
    }

    let chunk = remaining.slice(0, capacity)
    const lastSpace = chunk.lastIndexOf(' ')
    if (lastSpace > Math.floor(capacity * 0.4)) {
      chunk = remaining.slice(0, lastSpace)
    }

    lines.push(clipLine(`${prefix}${chunk}`, width))
    remaining = remaining.slice(chunk.length).trimStart()
    isFirst = false
  }

  return lines.length ? lines : [clipLine(label, width)]
}

export function formatMoneyLines(label: string, amount: number, width = RECEIPT_WIDTH): string[] {
  const value = formatMoney(amount)
  const gap = width - label.length - value.length

  if (gap >= 1) {
    return [`${label}${' '.repeat(gap)}${value}`]
  }

  const amountLine = value.padStart(width).slice(0, width)
  if (label.length <= width) {
    return [clipLine(label, width), amountLine]
  }

  return [...wrapText(label, width).map((row) => clipLine(row, width)), amountLine]
}

export function formatMoney(amount: number) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatMoneyLine(label: string, amount: number, width = RECEIPT_WIDTH) {
  return formatMoneyLines(label, amount, width)[0] ?? ''
}

export function normalizeVatRate(rate: number) {
  if (rate > 1) {
    return rate / 100
  }
  return rate
}

export function formatVatLabel(rate: number) {
  const normalized = normalizeVatRate(rate)
  const pct = (normalized * 100).toFixed(2)
  return `VAT(${pct}%)`
}

export function formatDiscLabel(rate: number) {
  const pct = (rate * 100).toFixed(2)
  return `DISC(${pct}%)`
}

export function formatReceiptDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) {
    hours = 12
  }
  const h = String(hours).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${minutes}:${seconds} ${ampm}`
}

export function formatHeadingDate(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return text.slice(0, 10)
  }
  const y = parsed.getFullYear()
  const m = parsed.getMonth() + 1
  const d = parsed.getDate()
  return `${m}/${d}/${y}`
}

export function wrapText(text: string, width = RECEIPT_WIDTH) {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return []
  }

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current) {
      lines.push(current)
      current = ''
    }
  }

  for (const word of words) {
    let remainingWord = word

    while (remainingWord.length > width) {
      pushCurrent()
      lines.push(remainingWord.slice(0, width))
      remainingWord = remainingWord.slice(width)
    }

    const next = current ? `${current} ${remainingWord}` : remainingWord
    if (next.length <= width) {
      current = next
      continue
    }

    pushCurrent()
    current = remainingWord
  }

  pushCurrent()
  return lines
}

/** Push one or more wrapped lines (clip-safe per row). */
export function pushWrappedText(rows: string[], text: string, width = RECEIPT_WIDTH) {
  const lines = wrapText(text, width)
  if (!lines.length) {
    return
  }
  for (const row of lines) {
    rows.push(clipLine(row, width))
  }
}

export function pushLabelValueLines(rows: string[], label: string, value: string, width = RECEIPT_WIDTH) {
  rows.push(...labelValueLines(label, value, width))
}

export function pushMoneyLines(rows: string[], label: string, amount: number, width = RECEIPT_WIDTH) {
  rows.push(...formatMoneyLines(label, amount, width))
}
