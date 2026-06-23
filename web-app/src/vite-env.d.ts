/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ONLINE_BASE_URL?: string
  readonly VITE_API_OFFLINE_BASE_URL?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_THEME?: string
  readonly REACT_APP_THEME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
