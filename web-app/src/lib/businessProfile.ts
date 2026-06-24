import type { ChangeEvent, DragEvent, KeyboardEvent, RefObject } from 'react'

export const vatTypeOptions = ['VAT REG TIN', 'VAT-EXEMPT TIN'] as const
export const priceVatModeOptions = [
  { value: 'INCLUSIVE', label: 'VAT Inclusive' },
  { value: 'EXCLUSIVE', label: 'VAT Exclusive' },
] as const

export const allowedLogoMimeTypes = new Set(['image/png'])
export const allowedLogoAccept = 'image/png,.png'
export const allowedLogoHint = 'PNG only. Max size: 2 MB.'
export const maxLogoBytes = 2 * 1024 * 1024

export type BusinessProfileFields = {
  busi_name: string
  busi_addr: string
  busi_owner: string
  busi_vat_type: string
  busi_tin: string
  vat_rate: string
  price_vat_mode: string
  business_logo_path: string
}

export const initialBusinessProfile: BusinessProfileFields = {
  busi_name: '',
  busi_addr: '',
  busi_owner: '',
  busi_vat_type: '',
  busi_tin: '',
  vat_rate: '',
  price_vat_mode: 'INCLUSIVE',
  business_logo_path: '',
}

export function isPngLogoFile(file: File) {
  if (allowedLogoMimeTypes.has(file.type)) {
    return true
  }

  return /\.png$/i.test(file.name)
}

export function validateLogoFile(file: File) {
  if (!isPngLogoFile(file)) {
    return 'Logo must be a PNG file.'
  }

  if (file.size > maxLogoBytes) {
    return 'Logo file must be 2 MB or less.'
  }

  return null
}

export function mapBusinessProfileFromRow(data: Record<string, unknown> | null | undefined): BusinessProfileFields {
  if (!data) {
    return { ...initialBusinessProfile }
  }

  return {
    busi_name: String(data.busi_name || ''),
    busi_addr: String(data.busi_addr || ''),
    busi_owner: String(data.busi_owner || ''),
    busi_vat_type: String(data.busi_vat_type || ''),
    busi_tin: String(data.busi_tin || ''),
    vat_rate: data.vat_rate === null || data.vat_rate === undefined ? '' : String(data.vat_rate),
    price_vat_mode: String(data.price_vat_mode || 'INCLUSIVE').toUpperCase() === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE',
    business_logo_path: String(data.business_logo_path || ''),
  }
}

export function applyVatTypeChange<T extends BusinessProfileFields>(
  current: T,
  value: string,
  lastVatRegRate: string,
): T {
  return {
    ...current,
    busi_vat_type: value,
    vat_rate:
      value === 'VAT-EXEMPT TIN'
        ? '0.00'
        : value === 'VAT REG TIN'
          ? lastVatRegRate
          : current.vat_rate,
  }
}

export function handleLogoDrop(
  event: DragEvent<HTMLDivElement>,
  setDragOver: (value: boolean) => void,
  onSelect: (file: File | null) => void,
) {
  event.preventDefault()
  setDragOver(false)
  const file = event.dataTransfer.files?.[0] || null
  onSelect(file)
}

export function handleLogoDragOver(event: DragEvent<HTMLDivElement>, setDragOver: (value: boolean) => void) {
  event.preventDefault()
  setDragOver(true)
}

export function handleLogoDragLeave(setDragOver: (value: boolean) => void) {
  setDragOver(false)
}

export function handleLogoDropzoneKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  inputRef: RefObject<HTMLInputElement | null>,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    inputRef.current?.click()
  }
}

export function getLogoDropzoneStatus(isUploading: boolean, file: File | null, savedPath: string) {
  if (isUploading) {
    return 'Uploading...'
  }

  if (file) {
    return file.name
  }

  if (savedPath) {
    return 'Logo applied'
  }

  return 'No file selected'
}

export function appendBusinessProfileToFormData(payload: FormData, profile: BusinessProfileFields) {
  payload.append('busi_name', profile.busi_name)
  payload.append('busi_addr', profile.busi_addr)
  payload.append('busi_owner', profile.busi_owner)
  payload.append('busi_vat_type', profile.busi_vat_type)
  payload.append('busi_tin', profile.busi_tin)
  payload.append('vat_rate', profile.vat_rate.trim() === '' ? '' : String(Number(profile.vat_rate)))
  payload.append(
    'price_vat_mode',
    profile.busi_vat_type === 'VAT-EXEMPT TIN' ? 'INCLUSIVE' : profile.price_vat_mode,
  )
  payload.append('business_logo_path', profile.business_logo_path)
}

export function handleBusinessFieldChange<T extends BusinessProfileFields>(
  current: T,
  event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  setLastVatRegRate?: (value: string) => void,
): T {
  const { name, value } = event.target

  if (name === 'vat_rate' && setLastVatRegRate) {
    setLastVatRegRate(value)
  }

  return { ...current, [name]: value } as T
}
