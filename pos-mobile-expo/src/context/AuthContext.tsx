import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as loginApi, logout as logoutApi } from '../services/api/authApi'
import { setAuthToken, setUnauthorizedHandler } from '../services/api/client'
import type { SessionUser } from '../types/pos'

type AuthContextValue = {
  user: SessionUser | null
  isLoading: boolean
  login: (username: string, password: string, machineName?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } catch {
      // ignore logout errors
    } finally {
      setAuthToken(null)
      setUser(null)
    }
  }, [])

  const login = useCallback(async (username: string, password: string, machineName?: string) => {
    setIsLoading(true)

    try {
      const result = await loginApi(username, password, machineName)

      if (!result.token) {
        throw new Error('Mobile token was not returned by the server.')
      }

      setAuthToken(result.token)
      setUser(result.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null)
      setUser(null)
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
