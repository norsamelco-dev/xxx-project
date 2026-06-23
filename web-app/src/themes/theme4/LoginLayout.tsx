import type { LoginLayoutProps } from '../types'
import { LoginForm } from '../shared/LoginForm'
import { resolveAssetUrl } from '../../lib/api'

export function Theme4LoginLayout({
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
  const logoSrc = resolveAssetUrl(receiptHeading?.business_logo_path) || themeLogoSrc
  const companyName = receiptHeading?.busi_name || themeCompanyName

  return (
    <main className="login-shell theme4-login-shell">
      <section className="theme4-login-minimal">
        {logoSrc ? (
          <img src={logoSrc} alt="Business logo" className="theme4-login-logo" style={{ height: `${businessLogoHeight}px` }} />
        ) : null}
        <span className="eyebrow">{receiptHeading?.busi_vat_type || 'Welcome'}</span>
        <h1 ref={businessNameRef}>{companyName}</h1>
        <p>{receiptHeading?.busi_addr || 'Minimal sign-in experience'}</p>
        <article className="login-card theme4-login-card">
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
      </section>
    </main>
  )
}
