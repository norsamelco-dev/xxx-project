const { contextBridge } = require('electron')
const fs = require('fs')
const path = require('path')

const CONFIG_DIR = 'C:\\pos\\temp'
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')
const API_BASE_CONFIG_PATH = path.join(CONFIG_DIR, 'api-base-config.json')

function ensureConfigDirectory() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function readConfigRaw() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null
  }
  return fs.readFileSync(CONFIG_PATH, 'utf8')
}

function readApiBaseConfigRaw() {
  if (!fs.existsSync(API_BASE_CONFIG_PATH)) {
    return null
  }
  return fs.readFileSync(API_BASE_CONFIG_PATH, 'utf8')
}

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  configPath: CONFIG_PATH,
  configExists: async () => fs.existsSync(CONFIG_PATH),
  loadConfig: async () => {
    const raw = readConfigRaw()
    if (!raw) {
      return null
    }
    return JSON.parse(raw)
  },
  saveConfig: async (config) => {
    ensureConfigDirectory()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
  },
  deleteConfig: async () => {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH)
    }
  },
  apiBaseConfigExists: async () => fs.existsSync(API_BASE_CONFIG_PATH),
  loadApiBaseConfig: async () => {
    const raw = readApiBaseConfigRaw()
    if (!raw) {
      return null
    }
    return JSON.parse(raw)
  },
  saveApiBaseConfig: async (config) => {
    ensureConfigDirectory()
    fs.writeFileSync(API_BASE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
  },
  deleteApiBaseConfig: async () => {
    if (fs.existsSync(API_BASE_CONFIG_PATH)) {
      fs.unlinkSync(API_BASE_CONFIG_PATH)
    }
  },
})
