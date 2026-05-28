import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES } from '../lib/audit'
import { usePageVisitAudit } from './usePageVisitAudit'
import type { ReceiptHeadingPublic } from '../themes/types'

export function useLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  usePageVisitAudit(AUDIT_PAGES.LOGIN)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receiptHeading, setReceiptHeading] = useState<ReceiptHeadingPublic | null>(null)
  const [businessLogoHeight, setBusinessLogoHeight] = useState(64)
  const businessNameRef = useRef<HTMLHeadingElement | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard-x'

  useEffect(() => {
    void loadReceiptHeadingPublic()
  }, [])

  useEffect(() => {
    function updateBusinessLogoHeight() {
      const heading = businessNameRef.current
      if (!heading) {
        return
      }

      const styles = window.getComputedStyle(heading)
      const fontSize = Number.parseFloat(styles.fontSize) || 16
      const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.2
      const renderedHeight = heading.getBoundingClientRect().height
      const lines = Math.max(1, Math.round(renderedHeight / lineHeight))
      setBusinessLogoHeight(Math.max(64, Math.round(lineHeight * lines)))
    }

    updateBusinessLogoHeight()
    window.addEventListener('resize', updateBusinessLogoHeight)

    return () => {
      window.removeEventListener('resize', updateBusinessLogoHeight)
    }
  }, [receiptHeading?.busi_name])

  async function loadReceiptHeadingPublic() {
    try {
      const payload = await apiFetch<{ data: ReceiptHeadingPublic | null }>('/api/receipt-heading/public')
      setReceiptHeading(payload.data)
    } catch (_loadError) {
      setReceiptHeading(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(username, password)
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    receiptHeading,
    businessLogoHeight,
    businessNameRef,
    username,
    password,
    error,
    isSubmitting,
    onUsernameChange: setUsername,
    onPasswordChange: setPassword,
    onSubmit: handleSubmit,
  }
}
