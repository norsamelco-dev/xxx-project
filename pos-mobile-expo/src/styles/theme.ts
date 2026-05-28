import { resolveThemeId, themePalettes, type ThemeId, type ThemePalette } from './themes'

export const THEME_STORAGE_KEY = '@linda-lim-pos/ui_theme'

const colorKeys: Array<keyof ThemePalette> = [
  'bg',
  'surface',
  'surfaceAlt',
  'border',
  'text',
  'textMuted',
  'accent',
  'good',
  'bad',
  'warning',
]

function readStoredThemeId(): ThemeId {
  if (typeof localStorage === 'undefined') {
    return 'default'
  }
  return resolveThemeId(localStorage.getItem(THEME_STORAGE_KEY))
}

let activeThemeId: ThemeId = readStoredThemeId()

function applyPalette(palette: ThemePalette) {
  for (const key of colorKeys) {
    colors[key] = palette[key]
  }
}

export const colors: ThemePalette = { ...themePalettes[activeThemeId] }

export function getActiveThemeId(): ThemeId {
  return activeThemeId
}

export function setActiveTheme(themeId: unknown) {
  activeThemeId = resolveThemeId(themeId)
  applyPalette(themePalettes[activeThemeId])
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, activeThemeId)
  }
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
}
