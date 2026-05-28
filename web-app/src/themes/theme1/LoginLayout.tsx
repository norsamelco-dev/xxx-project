import type { LoginLayoutProps } from '../types'
import { LoginForm } from '../shared/LoginForm'

export function Theme1LoginLayout({
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
    <main className="login-shell theme1-login-shell">
      <section className="theme1-login-centered">
        <article className="login-card theme1-login-card">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Business logo"
              className="theme1-login-logo"
              style={{ height: `${businessLogoHeight}px` }}
            />
          ) : (
            <div className="theme1-login-logo-fallback">{companyName.charAt(0)}</div>
          )}
          <h1 ref={businessNameRef} className="theme1-login-title">
            {companyName}
          </h1>
          <p className="theme1-login-subtitle">{receiptHeading?.busi_addr || 'Sign in to continue'}</p>
          <h2>Sign in</h2>
          <p>Enter the same credentials your current system already uses.</p>
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
