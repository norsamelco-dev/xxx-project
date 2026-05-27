import { useTheme } from '../context/useTheme'
import type { LoginLayoutProps } from '../themes/types'

export function ThemedLogin(props: Omit<LoginLayoutProps, 'themeLogoSrc' | 'themeCompanyName'>) {
  const { theme } = useTheme()
  const LoginLayout = theme.LoginLayout

  return (
    <LoginLayout
      themeLogoSrc={theme.logoSrc}
      themeCompanyName={theme.companyName}
      {...props}
    />
  )
}
