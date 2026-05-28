import { theme1 } from './theme1'
import { theme2 } from './theme2'
import { theme3 } from './theme3'
import { theme4 } from './theme4'
import { theme5 } from './theme5'
import { getEnvThemeId, resolveActiveThemeId, isValidThemeId } from './resolveTheme'
import type { ThemeDefinition, ThemeId } from './types'

export const themesRegistry: Record<ThemeId, ThemeDefinition> = {
  theme1,
  theme2,
  theme3,
  theme4,
  theme5,
}

export const themeList = Object.values(themesRegistry)

export function getThemeById(themeId: ThemeId): ThemeDefinition {
  return themesRegistry[themeId]
}

export { getEnvThemeId, resolveActiveThemeId, isValidThemeId }
export type { ThemeDefinition, ThemeId, LoginLayoutProps, ThemeButtonProps, ThemeDataGridProps } from './types'
