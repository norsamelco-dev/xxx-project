import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiProxyFailoverPlugin } from './vite-api-proxy-failover'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appTheme = env.REACT_APP_THEME || env.VITE_APP_THEME || 'theme1'
  const onlineApiUrl = env.VITE_API_ONLINE_BASE_URL || env.VITE_API_BASE_URL || ''
  const offlineApiUrl = env.VITE_API_OFFLINE_BASE_URL || ''

  return {
    plugins: [react(), apiProxyFailoverPlugin(onlineApiUrl, offlineApiUrl)],
    define: {
      'import.meta.env.REACT_APP_THEME': JSON.stringify(appTheme),
    },
    server: {
      port: 5173,
      allowedHosts: ['pos.lindalim.shop'],
    },
  }
})
