import { createContext } from 'react'
import type { ThemeDefinition, ThemeId } from '../themes/types'

export type ThemeContextValue = {
  theme: ThemeDefinition
  themeId: ThemeId
  defaultThemeId: ThemeId
  setThemeId: (themeId: ThemeId) => void
  resetToDefault: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
