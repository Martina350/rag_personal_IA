import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api/client'
import { ApiError } from '../api/client'
import type { UserMe } from '../types'

const TOKEN_KEY = 'rag_auth_token'

type AuthContextValue = {
  token: string | null
  user: UserMe | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const current = localStorage.getItem(TOKEN_KEY)
    if (!current) {
      clearSession()
      setLoading(false)
      return
    }
    try {
      const me = await api.fetchMe(current)
      setToken(current)
      setUser(me)
    } catch (error) {
      clearSession()
      if (!(error instanceof ApiError && error.status === 401)) {
        throw error
      }
    } finally {
      setLoading(false)
    }
  }, [clearSession])

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.login(username.trim(), password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    setUser({
      username: data.username,
      role_name: data.role_name,
      role_label: data.role_label,
      tone_key: data.tone_key,
      is_admin: data.is_admin,
      permissions: data.permissions,
    })
  }, [])

  const logout = useCallback(async () => {
    const current = localStorage.getItem(TOKEN_KEY)
    if (current) {
      try {
        await api.logout(current)
      } catch {
        // Limpiar sesión local aunque el servidor falle
      }
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refreshMe, clearSession }),
    [token, user, loading, login, logout, refreshMe, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
