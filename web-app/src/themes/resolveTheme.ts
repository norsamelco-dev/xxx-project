import { THEME_IDS, type ThemeId } from './types'

export const themeStorageKey = 'pos_theme'

export function isValidThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && THEME_IDS.includes(value as ThemeId))
}

export function getEnvThemeId(): ThemeId {
  const env = import.meta.env.VITE_APP_THEME || import.meta.env.REACT_APP_THEME || 'theme1'
  return isValidThemeId(env) ? env : 'theme1'
}

export function readStoredThemeId(): ThemeId | null {
  try {
    const stored = localStorage.getItem(themeStorageKey)
    return isValidThemeId(stored) ? stored : null
  } catch {
    return null
  }
}

export function resolveActiveThemeId(): ThemeId {
  return readStoredThemeId() ?? getEnvThemeId()
}

export function writeStoredThemeId(themeId: ThemeId) {
  localStorage.setItem(themeStorageKey, themeId)
}

export function clearStoredThemeId() {
  localStorage.removeItem(themeStorageKey)
}
