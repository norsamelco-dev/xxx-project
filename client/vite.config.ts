import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appTheme = env.REACT_APP_THEME || env.VITE_APP_THEME || 'theme1'

  return {
  plugins: [react()],
  define: {
    'import.meta.env.REACT_APP_THEME': JSON.stringify(appTheme),
  },
  server: {
    port: 5173,
    allowedHosts: ['pos.lindalim.shop'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  }
})