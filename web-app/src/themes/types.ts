import type { ButtonHTMLAttributes, FormEvent, ReactElement, ReactNode, RefObject } from 'react'

export type ThemeId = 'theme1' | 'theme2' | 'theme3' | 'theme4' | 'theme5'

export const THEME_IDS: ThemeId[] = ['theme1', 'theme2', 'theme3', 'theme4', 'theme5']

export type ThemeColors = {
  primary: string
  secondary: string
  accent: string
  bg: string
  surface: string
  surfaceStrong: string
  text: string
  textMuted: string
  line: string
  good: string
  bad: string
  shadow: string
  sidebar: string
}

export type ReceiptHeadingPublic = {
  busi_name: string | null
  busi_addr: string | null
  busi_owner: string | null
  busi_vat_type: string | null
  busi_tin: string | null
  vat_rate: number | string | null
  price_vat_mode?: string | null
  developer: string | null
  accreditation_no: string | null
  softwareversion: string | null
  contactdetail: string | null
  business_logo_path: string | null
  developer_logo_path: string | null
}

export type LoginLayoutProps = {
  themeLogoSrc: string
  themeCompanyName: string
  receiptHeading: ReceiptHeadingPublic | null
  businessLogoHeight: number
  businessNameRef: RefObject<HTMLHeadingElement | null>
  username: string
  password: string
  error: string
  isSubmitting: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export type ThemeButtonVariant = 'primary' | 'secondary'

export type ThemeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ThemeButtonVariant
}

export type ThemeDataGridProps = {
  children: ReactElement<{ className?: string }>
  variant?: string
  className?: string
}

export type ThemeDefinition = {
  id: ThemeId
  label: string
  companyName: string
  logoSrc: string
  fonts: { display: string; body: string; mono: string }
  colors: ThemeColors
  cssVars: Record<string, string>
  LoginLayout: (props: LoginLayoutProps) => ReactNode
  Button: (props: ThemeButtonProps) => ReactNode
  DataGrid: (props: ThemeDataGridProps) => ReactNode
}
