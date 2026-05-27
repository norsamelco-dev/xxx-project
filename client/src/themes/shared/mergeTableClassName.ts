export function mergeTableClassName(baseClass: string, existing?: string, variant?: string) {
  const parts = [baseClass, existing, variant ? `data-table--${variant}` : ''].filter(Boolean)
  return parts.join(' ').trim()
}
