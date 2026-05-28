import { useEffect, useRef } from 'react'
import { buildAuditDescription, recordAuditEvent, type AuditMeta } from '../lib/audit'

export function usePageVisitAudit(page: string, detail?: string) {
  const hasLoggedRef = useRef(false)

  useEffect(() => {
    if (hasLoggedRef.current) {
      return
    }

    hasLoggedRef.current = true

    const description = detail
      ? buildAuditDescription(page, detail)
      : buildAuditDescription(page, 'Opened this page.')

    const meta: AuditMeta = {
      page,
      action: 'VIEW PAGE',
      description,
    }

    void recordAuditEvent(meta).catch(() => {
      // Page visit logging should not block navigation.
    })
  }, [page, detail])
}
