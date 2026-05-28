import type { LoginLayoutProps } from '../types'
import { LoginForm } from '../shared/LoginForm'

export function Theme3LoginLayout({
  themeLogoSrc,
  themeCompanyName,
  receiptHeading,
  businessLogoHeight,
  businessNameRef,
  username,
  password,
  error,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginLayoutProps) {
  const logoSrc = receiptHeading?.business_logo_path || themeLogoSrc
  const companyName = receiptHeading?.busi_name || themeCompanyName

  return (
    <main className="login-shell theme3-login-shell">
      <div className="theme3-login-backdrop" aria-hidden="true" />
      <article className="login-card theme3-login-float">
        {logoSrc ? (
          <img src={logoSrc} alt="Business logo" className="theme3-login-logo" style={{ height: `${businessLogoHeight}px` }} />
        ) : null}
        <h1 ref={businessNameRef}>{companyName}</h1>
        <p>{receiptHeading?.busi_vat_type || 'Secure access'}</p>
        <h2>Sign in</h2>
        <LoginForm
          username={username}
          password={password}
          error={error}
          isSubmitting={isSubmitting}
          onUsernameChange={onUsernameChange}
          onPasswordChange={onPasswordChange}
          onSubmit={onSubmit}
        />
      </article>
    </main>
  )
}
