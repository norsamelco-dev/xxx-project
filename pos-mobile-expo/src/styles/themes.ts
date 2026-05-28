export const THEME_IDS = ['default', 'ocean', 'forest', 'sunset', 'violet', 'graphite'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export type ThemePalette = {
  bg: string
  surface: string
  surfaceAlt: string
  border: string
  text: string
  textMuted: string
  accent: string
  good: string
  bad: string
  warning: string
}

export const themePalettes: Record<ThemeId, ThemePalette> = {
  default: {
    bg: '#0f172a',
    surface: '#1e293b',
    surfaceAlt: '#334155',
    border: '#475569',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#38bdf8',
    good: '#4ade80',
    bad: '#f87171',
    warning: '#fbbf24',
  },
  ocean: {
    bg: '#081c2e',
    surface: '#11324d',
    surfaceAlt: '#1f4c6a',
    border: '#2b6786',
    text: '#edf7ff',
    textMuted: '#9dc4e0',
    accent: '#60d6ff',
    good: '#7ff2b4',
    bad: '#ff8a8a',
    warning: '#ffd166',
  },
  forest: {
    bg: '#0b1c14',
    surface: '#173225',
    surfaceAlt: '#224433',
    border: '#355a45',
    text: '#f2fff7',
    textMuted: '#9bb9aa',
    accent: '#68e0a0',
    good: '#7af2a5',
    bad: '#ff8a8a',
    warning: '#f5d66f',
  },
  sunset: {
    bg: '#2a1320',
    surface: '#402033',
    surfaceAlt: '#5a2f48',
    border: '#7a4761',
    text: '#fff4f7',
    textMuted: '#d9a9bb',
    accent: '#ff9f7a',
    good: '#8ef6b2',
    bad: '#ff7f93',
    warning: '#ffd37d',
  },
  violet: {
    bg: '#1a1534',
    surface: '#2a2250',
    surfaceAlt: '#3a2f6b',
    border: '#54438c',
    text: '#f6f2ff',
    textMuted: '#b5a9d8',
    accent: '#9aa7ff',
    good: '#83efc4',
    bad: '#ff8ca6',
    warning: '#f6d67a',
  },
  graphite: {
    bg: '#111315',
    surface: '#1c2024',
    surfaceAlt: '#2a3036',
    border: '#3a434d',
    text: '#f5f7fa',
    textMuted: '#9ea8b3',
    accent: '#7dc9ff',
    good: '#71e59d',
    bad: '#ff8a8a',
    warning: '#f4c96a',
  },
}

export const themeOptions: Array<{ id: ThemeId; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'violet', label: 'Violet' },
  { id: 'graphite', label: 'Graphite' },
]

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

export function resolveThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : 'default'
}
