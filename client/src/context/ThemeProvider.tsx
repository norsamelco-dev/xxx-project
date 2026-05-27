import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getEnvThemeId, getThemeById, resolveActiveThemeId } from '../themes'
import { clearStoredThemeId, writeStoredThemeId } from '../themes/resolveTheme'
import type { ThemeId } from '../themes/types'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const defaultThemeId = useMemo(() => getEnvThemeId(), [])
  const [themeId, setThemeIdState] = useState<ThemeId>(() => resolveActiveThemeId())
  const theme = useMemo(() => getThemeById(themeId), [themeId])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme.id

    Object.entries(theme.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    root.style.setProperty('--display', theme.fonts.display)
    root.style.setProperty('--body', theme.fonts.body)
    root.style.setProperty('--mono', theme.fonts.mono)
    root.style.fontFamily = theme.fonts.body
  }, [theme])

  const setThemeId = useCallback((nextThemeId: ThemeId) => {
    writeStoredThemeId(nextThemeId)
    setThemeIdState(nextThemeId)
  }, [])

  const resetToDefault = useCallback(() => {
    clearStoredThemeId()
    setThemeIdState(defaultThemeId)
  }, [defaultThemeId])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeId,
      defaultThemeId,
      setThemeId,
      resetToDefault,
    }),
    [theme, themeId, defaultThemeId, setThemeId, resetToDefault],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
