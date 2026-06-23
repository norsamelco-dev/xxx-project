import type { LoginLayoutProps } from '../types'
import { LoginForm } from '../shared/LoginForm'
import { resolveAssetUrl } from '../../lib/api'

export function Theme2LoginLayout({
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
    <main className="login-shell theme2-login-shell">
      <section className="theme2-login-split">
        <aside className="theme2-login-visual" aria-hidden="true">
          <div className="theme2-login-visual__content">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="theme2-login-visual__logo" style={{ height: `${businessLogoHeight}px` }} />
            ) : null}
            <h1 ref={businessNameRef}>{companyName}</h1>
            <p>{receiptHeading?.busi_addr || 'Point of sale workspace'}</p>
          </div>
        </aside>
        <article className="login-card theme2-login-form">
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
