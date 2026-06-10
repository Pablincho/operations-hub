import { createContext, useContext, useState, useCallback } from 'react'
import api from '@/services/api'

const AuthContext = createContext(null)

function decodeJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = decodeJWT(token)
    if (!payload) return null
    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token')
      return null
    }
    return payload
  })

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  // Refresh user data from DB + replace stored JWT so funciones are current on next request
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      const fresh = res.data.data
      if (res.data.token) {
        localStorage.setItem('token', res.data.token)
      }
      setUser(prev => ({ ...prev, ...fresh }))
      return fresh
    } catch {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
