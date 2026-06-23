import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import httpProxy from 'http-proxy'

type ProxyTarget = {
  label: 'online' | 'offline'
  url: string
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function buildTargets(online: string, offline: string): ProxyTarget[] {
  const targets: ProxyTarget[] = []
  const normalizedOnline = normalizeBaseUrl(online)
  const normalizedOffline = normalizeBaseUrl(offline)

  if (normalizedOnline) {
    targets.push({ label: 'online', url: normalizedOnline })
  }

  if (normalizedOffline && normalizedOffline !== normalizedOnline) {
    targets.push({ label: 'offline', url: normalizedOffline })
  }

  if (targets.length === 0) {
    targets.push({ label: 'offline', url: 'http://localhost:5000' })
  }

  return targets
}

function isConnectionError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNABORTED'].includes(code)
}

export function apiProxyFailoverPlugin(onlineUrl: string, offlineUrl: string): Plugin {
  const targets = buildTargets(onlineUrl, offlineUrl)
  let stickyTarget: ProxyTarget | null = null

  function getTryOrder(): ProxyTarget[] {
    if (stickyTarget) {
      return [stickyTarget, ...targets.filter((target) => target.url !== stickyTarget?.url)]
    }

    return targets
  }

  return {
    name: 'api-proxy-failover',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const requestUrl = req.url || ''

        if (!requestUrl.startsWith('/api')) {
          next()
          return
        }

        const tryOrder = getTryOrder()
        let index = 0

        const attempt = () => {
          const target = tryOrder[index]

          if (!target) {
            if (!res.headersSent) {
              res.statusCode = 502
              res.end('API unavailable')
            }
            return
          }

          const proxy = httpProxy.createProxyServer({
            changeOrigin: true,
            ws: true,
          })

          proxy.once('proxyRes', (proxyRes) => {
            proxyRes.headers['x-pos-api-target'] = target.label
            stickyTarget = target
          })

          proxy.once('error', (error) => {
            proxy.close()

            if (isConnectionError(error) && index < tryOrder.length - 1) {
              if (stickyTarget?.url === target.url) {
                stickyTarget = null
              }

              index += 1
              attempt()
              return
            }

            if (!res.headersSent) {
              res.statusCode = 502
              res.end('API proxy error')
            }
          })

          proxy.web(req, res, { target: target.url })
        }

        attempt()
      })
    },
  }
}
