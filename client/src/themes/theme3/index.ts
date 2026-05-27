import { buildCssVars } from '../buildCssVars'
import type { ThemeDefinition } from '../types'
import { Theme3Button } from './Button'
import { Theme3DataGrid } from './DataGrid'
import { Theme3LoginLayout } from './LoginLayout'
import './theme3.css'

const colors = {
  primary: '#7c3aed',
  secondary: '#312e81',
  accent: '#ec4899',
  bg: '#f5f3ff',
  surface: 'rgba(255, 255, 255, 0.92)',
  surfaceStrong: '#ffffff',
  text: '#1e1b4b',
  textMuted: '#6b7280',
  line: 'rgba(49, 46, 129, 0.12)',
  good: '#15803d',
  bad: '#dc2626',
  shadow: '0 20px 50px rgba(49, 46, 129, 0.12)',
  sidebar: '#312e81',
}

export const theme3: ThemeDefinition = {
  id: 'theme3',
  label: 'Client C',
  companyName: 'Client C POS',
  logoSrc: '/themes/theme3/logo.svg',
  fonts: {
    display: "Georgia, 'Times New Roman', serif",
    body: "'Segoe UI', system-ui, sans-serif",
    mono: "'Cascadia Code', Consolas, monospace",
  },
  colors,
  cssVars: {
    ...buildCssVars(colors),
    '--display': "Georgia, 'Times New Roman', serif",
    '--body': "'Segoe UI', system-ui, sans-serif",
    '--mono': "'Cascadia Code', Consolas, monospace",
  },
  LoginLayout: Theme3LoginLayout,
  Button: Theme3Button,
  DataGrid: Theme3DataGrid,
}
