import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { ApiError, api } from "@/lib/api"
import type { User } from "@/types"

const TOKEN_STORAGE_KEY = "courtly.token"

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => localStorage.getItem(TOKEN_STORAGE_KEY) !== null)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    api
      .me(token)
      .then((fetchedUser) => {
        if (!cancelled) setUser(fetchedUser)
      })
      .catch((error: unknown) => {
        // Only an explicit rejection means the token is invalid — a transient
        // network hiccup (e.g. a page reload aborting the request) shouldn't
        // sign the user out.
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          setToken(null)
          localStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const applySession = useCallback((accessToken: string, sessionUser: User) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
    setToken(accessToken)
    setUser(sessionUser)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.login(email, password)
      applySession(response.access_token, response.user)
    },
    [applySession],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await api.register(name, email, password)
      applySession(response.access_token, response.user)
    },
    [applySession],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser)
  }, [])

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, updateUser }),
    [user, token, isLoading, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
