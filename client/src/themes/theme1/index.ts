import { buildCssVars } from '../buildCssVars'
import type { ThemeDefinition } from '../types'
import { Theme1Button } from './Button'
import { Theme1DataGrid } from './DataGrid'
import { Theme1LoginLayout } from './LoginLayout'
import './theme1.css'

const colors = {
  primary: '#4f46e5',
  secondary: '#111827',
  accent: '#14b8a6',
  bg: '#eef2f7',
  surface: 'rgba(255, 255, 255, 0.9)',
  surfaceStrong: '#ffffff',
  text: '#0f172a',
  textMuted: '#667085',
  line: 'rgba(15, 23, 42, 0.1)',
  good: '#15803d',
  bad: '#b91c1c',
  shadow: '0 24px 60px rgba(15, 23, 42, 0.1)',
  sidebar: '#111827',
}

export const theme1: ThemeDefinition = {
  id: 'theme1',
  label: 'Client A',
  companyName: 'Linda Lim POS',
  logoSrc: '/themes/theme1/logo.svg',
  fonts: {
    display: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    body: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    mono: "'Cascadia Code', Consolas, monospace",
  },
  colors,
  cssVars: {
    ...buildCssVars(colors),
    '--display': "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    '--body': "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    '--mono': "'Cascadia Code', Consolas, monospace",
  },
  LoginLayout: Theme1LoginLayout,
  Button: Theme1Button,
  DataGrid: Theme1DataGrid,
}
