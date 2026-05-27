import { buildCssVars } from '../buildCssVars'
import type { ThemeDefinition } from '../types'
import { Theme4Button } from './Button'
import { Theme4DataGrid } from './DataGrid'
import { Theme4LoginLayout } from './LoginLayout'
import './theme4.css'

const colors = {
  primary: '#2563eb',
  secondary: '#1d4ed8',
  accent: '#f97316',
  bg: '#eff6ff',
  surface: 'rgba(255, 255, 255, 0.94)',
  surfaceStrong: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  line: 'rgba(37, 99, 235, 0.12)',
  good: '#16a34a',
  bad: '#dc2626',
  shadow: '0 18px 48px rgba(37, 99, 235, 0.12)',
  sidebar: '#1e40af',
}

export const theme4: ThemeDefinition = {
  id: 'theme4',
  label: 'Client D',
  companyName: 'Client D POS',
  logoSrc: '/themes/theme4/logo.svg',
  fonts: {
    display: "'Segoe UI', system-ui, sans-serif",
    body: "'Segoe UI', system-ui, sans-serif",
    mono: "'Cascadia Code', Consolas, monospace",
  },
  colors,
  cssVars: {
    ...buildCssVars(colors),
    '--display': "'Segoe UI', system-ui, sans-serif",
    '--body': "'Segoe UI', system-ui, sans-serif",
    '--mono': "'Cascadia Code', Consolas, monospace",
  },
  LoginLayout: Theme4LoginLayout,
  Button: Theme4Button,
  DataGrid: Theme4DataGrid,
}
