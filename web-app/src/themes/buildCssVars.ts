import type { ThemeColors } from './types'

export function buildCssVars(colors: ThemeColors): Record<string, string> {
  return {
    '--color-primary': colors.primary,
    '--color-secondary': colors.secondary,
    '--color-accent': colors.accent,
    '--bg': colors.bg,
    '--surface': colors.surface,
    '--surface-strong': colors.surfaceStrong,
    '--surface-contrast': colors.secondary,
    '--surface-sidebar': colors.sidebar,
    '--surface-sidebar-strong': colors.secondary,
    '--text': colors.text,
    '--text-muted': colors.textMuted,
    '--line': colors.line,
    '--accent': colors.accent,
    '--accent-soft': `${colors.accent}1f`,
    '--good': colors.good,
    '--bad': colors.bad,
    '--shadow': colors.shadow,
  }
}
