import type { LoginLayoutProps } from '../types'
import { LoginForm } from '../shared/LoginForm'
import { resolveAssetUrl } from '../../lib/api'

export function Theme5LoginLayout({
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
    <main className="login-shell theme5-login-shell">
      <section className="theme5-login-layout">
        <aside className="theme5-login-sidebar">
          {logoSrc ? (
            <img src={logoSrc} alt="Business logo" className="theme5-login-logo" style={{ height: `${businessLogoHeight}px` }} />
          ) : (
            <div className="theme5-login-logo-fallback">{companyName.charAt(0)}</div>
          )}
          <h1 ref={businessNameRef}>{companyName}</h1>
          <p>{receiptHeading?.busi_addr || 'Dark workspace theme'}</p>
          <div className="theme5-login-meta">
            <span>{receiptHeading?.busi_owner || 'Owner'}</span>
            <span>{receiptHeading?.busi_tin || 'TIN'}</span>
          </div>
        </aside>
        <article className="login-card theme5-login-form">
          <h2>Sign in</h2>
          <p>Enter your credentials to access the console.</p>
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
