import { buildCssVars } from '../buildCssVars'
import type { ThemeDefinition } from '../types'
import { Theme2Button } from './Button'
import { Theme2DataGrid } from './DataGrid'
import { Theme2LoginLayout } from './LoginLayout'
import './theme2.css'

const colors = {
  primary: '#0f766e',
  secondary: '#1e3a5f',
  accent: '#f59e0b',
  bg: '#f0fdfa',
  surface: 'rgba(255, 255, 255, 0.95)',
  surfaceStrong: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  line: 'rgba(15, 23, 42, 0.14)',
  good: '#15803d',
  bad: '#b91c1c',
  shadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
  sidebar: '#1e3a5f',
}

export const theme2: ThemeDefinition = {
  id: 'theme2',
  label: 'Client B',
  companyName: 'Client B POS',
  logoSrc: '/themes/theme2/logo.svg',
  fonts: {
    display: "Inter, 'Segoe UI', system-ui, sans-serif",
    body: "Inter, 'Segoe UI', system-ui, sans-serif",
    mono: "'Cascadia Code', Consolas, monospace",
  },
  colors,
  cssVars: {
    ...buildCssVars(colors),
    '--display': "Inter, 'Segoe UI', system-ui, sans-serif",
    '--body': "Inter, 'Segoe UI', system-ui, sans-serif",
    '--mono': "'Cascadia Code', Consolas, monospace",
  },
  LoginLayout: Theme2LoginLayout,
  Button: Theme2Button,
  DataGrid: Theme2DataGrid,
}
