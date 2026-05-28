import { buildCssVars } from '../buildCssVars'
import type { ThemeDefinition } from '../types'
import { Theme5Button } from './Button'
import { Theme5DataGrid } from './DataGrid'
import { Theme5LoginLayout } from './LoginLayout'
import './theme5.css'

const colors = {
  primary: '#38bdf8',
  secondary: '#0f172a',
  accent: '#22d3ee',
  bg: '#0b1220',
  surface: 'rgba(15, 23, 42, 0.92)',
  surfaceStrong: '#111827',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  line: 'rgba(148, 163, 184, 0.2)',
  good: '#4ade80',
  bad: '#f87171',
  shadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
  sidebar: '#0b1220',
}

export const theme5: ThemeDefinition = {
  id: 'theme5',
  label: 'Client E',
  companyName: 'Client E POS',
  logoSrc: '/themes/theme5/logo.svg',
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
  LoginLayout: Theme5LoginLayout,
  Button: Theme5Button,
  DataGrid: Theme5DataGrid,
}
