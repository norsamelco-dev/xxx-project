const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const http = require('http')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

const DEV_URL = 'http://127.0.0.1:8584'
const LOCAL_API_URL = 'http://127.0.0.1:5000'
const isDev = process.env.POS_DESKTOP_DEV === '1' || !app.isPackaged
const isKiosk = process.argv.includes('--kiosk') || process.env.POS_DESKTOP_KIOSK === '1'
const openFullscreen =
  isKiosk ||
  process.argv.includes('--fullscreen') ||
  process.env.POS_DESKTOP_FULLSCREEN === '1' ||
  (!isDev && process.env.POS_DESKTOP_WINDOWED !== '1' && process.env.POS_DESKTOP_FULLSCREEN !== '0')
const shouldSpawnServer =
  process.env.POS_DESKTOP_SKIP_SERVER !== '1' && process.env.POS_DESKTOP_SPAWN_SERVER === '1'

let mainWindow = null
let serverProcess = null
let rendererServer = null

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

function getRendererRoot() {
  return path.join(__dirname, 'dist', 'renderer')
}

function getRendererIndexPath() {
  return path.join(getRendererRoot(), 'index.html')
}

function startRendererStaticServer() {
  const root = getRendererRoot()

  return new Promise((resolve, reject) => {
    rendererServer = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0]
      const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '')
      const filePath = path.normalize(path.join(root, relativePath))

      if (!filePath.startsWith(root)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
        res.end(data)
      })
    })

    rendererServer.on('error', reject)
    rendererServer.listen(0, '127.0.0.1', () => {
      const address = rendererServer.address()
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function stopRendererStaticServer() {
  if (rendererServer) {
    rendererServer.close()
    rendererServer = null
  }
}

function getServerEntryPath() {
  return path.join(__dirname, '..', 'server', 'index.js')
}

function getServerCwd() {
  return path.join(__dirname, '..', 'server')
}

function waitForUrl(url, timeoutMs = 60000) {
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })

      request.on('error', retry)
      request.setTimeout(2000, () => {
        request.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(attempt, 500)
    }

    attempt()
  })
}

function startLocalApiServer() {
  if (!shouldSpawnServer || serverProcess) {
    return Promise.resolve()
  }

  const serverEntry = getServerEntryPath()
  const serverCwd = getServerCwd()

  if (!fs.existsSync(serverEntry)) {
    console.warn('[pos-desktop] Local API server not found at', serverEntry)
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [serverEntry], {
      cwd: serverCwd,
      env: {
        ...process.env,
        PORT: '5000',
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
      stdio: 'inherit',
      windowsHide: true,
    })

    serverProcess.on('error', reject)
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn('[pos-desktop] Local API server exited with code', code)
      }
      serverProcess = null
    })

    waitForUrl(`${LOCAL_API_URL}/api/local/printers`, 45000).then(resolve).catch(reject)
  })
}

function stopLocalApiServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

async function createMainWindow() {
  if (shouldSpawnServer) {
    try {
      await startLocalApiServer()
    } catch (error) {
      console.warn('[pos-desktop] Could not start local API server:', error.message)
    }
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    fullscreen: openFullscreen,
    kiosk: isKiosk,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (openFullscreen) {
      mainWindow.setFullScreen(true)
    } else {
      mainWindow.maximize()
    }
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key.toLowerCase() === 'r') {
        event.preventDefault()
      }
      if (input.key === 'F5') {
        event.preventDefault()
      }
    })
  }

  if (isDev) {
    await mainWindow.loadURL(DEV_URL)
    if (process.env.POS_DESKTOP_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
    return
  }

  const indexPath = getRendererIndexPath()
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing renderer bundle at ${indexPath}. Run npm run build:web first.`)
  }

  // Expo web export uses absolute /_expo/... paths that fail under file://
  const rendererUrl = await startRendererStaticServer()
  await mainWindow.loadURL(rendererUrl)
}

app.whenReady().then(() => {
  void createMainWindow().catch((error) => {
    console.error('[pos-desktop] Failed to start:', error)
    app.quit()
  })
})

app.on('window-all-closed', () => {
  stopLocalApiServer()
  stopRendererStaticServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopLocalApiServer()
  stopRendererStaticServer()
})
