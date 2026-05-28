import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { colors, spacing } from '../styles/theme'

type ToastContextValue = {
  showToast: (message: string, variant?: 'error' | 'info') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [variant, setVariant] = useState<'error' | 'info'>('info')
  const opacity = useRef(new Animated.Value(0)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hideToast = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMessage(null)
    })
  }, [opacity])

  const showToast = useCallback(
    (nextMessage: string, nextVariant: 'error' | 'info' = 'info') => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }

      setVariant(nextVariant)
      setMessage(nextMessage)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()

      hideTimer.current = setTimeout(() => {
        hideToast()
      }, TOAST_DURATION_MS)
    },
    [hideToast, opacity],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.lg,
            opacity,
            zIndex: 9999,
          }}
        >
          <Pressable
            onPress={hideToast}
            style={{
              backgroundColor: variant === 'error' ? '#7f1d1d' : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: variant === 'error' ? colors.bad : colors.border,
              borderRadius: 10,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>{message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
