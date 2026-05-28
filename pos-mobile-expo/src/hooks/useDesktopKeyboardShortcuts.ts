import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

type ShortcutHandlers = {
  onSearch?: () => void
  onCustomQty?: () => void
  onDiscount?: () => void
  onCheckout?: () => void
  enabled?: boolean
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

export function isCustomQtyShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key' | 'code'>) {
  const modPressed = event.ctrlKey || event.metaKey
  if (!modPressed) {
    return false
  }

  const key = event.key?.toLowerCase()
  return key === 'q' || event.code === 'KeyQ'
}

export function isSearchShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key' | 'code'>) {
  const modPressed = event.ctrlKey || event.metaKey
  if (!modPressed) {
    return false
  }

  const key = event.key?.toLowerCase()
  return key === 's' || event.code === 'KeyS'
}

export function isDiscountShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key' | 'code'>) {
  const modPressed = event.ctrlKey || event.metaKey
  if (!modPressed) {
    return false
  }

  const key = event.key?.toLowerCase()
  return key === 'd' || event.code === 'KeyD'
}

export function isCheckoutShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key' | 'code'>) {
  if (!(event.ctrlKey || event.metaKey)) {
    return false
  }
  return event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter'
}

export function useDesktopKeyboardShortcuts({
  onSearch,
  onCustomQty,
  onDiscount,
  onCheckout,
  enabled = true,
}: ShortcutHandlers) {
  const handlersRef = useRef({ onSearch, onCustomQty, onDiscount, onCheckout })

  handlersRef.current = { onSearch, onCustomQty, onDiscount, onCheckout }

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCustomQtyShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        handlersRef.current.onCustomQty?.()
        return
      }

      if (isSearchShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        handlersRef.current.onSearch?.()
        return
      }

      if (isCheckoutShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        handlersRef.current.onCheckout?.()
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (isDiscountShortcut(event)) {
        event.preventDefault()
        handlersRef.current.onDiscount?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [enabled])
}
