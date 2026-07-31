import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import api from '@/services/api'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext({ tieneCheckin: false, tieneRevisiones: false })

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const [tieneCheckin, setTieneCheckin] = useState(false)
  const [tieneRevisiones, setTieneRevisiones] = useState(false)

  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  const refresh = useCallback(async () => {
    if (!user) return

    // Mi Manual: check-in pendiente en alguna función donde el usuario es ocupante principal.
    // Si está de vacaciones, no se muestra notificación.
    try {
      if (user.enVacaciones) {
        setTieneCheckin(false)
      } else {
        const res = await api.get('/checkin/hoy')
        const { data: sessions = [], dailyCounts = {}, primaryStatusMap = {} } = res.data
        const funciones = user.funciones || []
        const pendiente = funciones.some(fn => {
          if (primaryStatusMap[fn] === false) return false
          const sesionHoy = sessions.find(s => s.funcion === fn)
          return !sesionHoy?.completado && (dailyCounts[fn] || 0) < 20
        })
        setTieneCheckin(pendiente)
      }
    } catch {}

    // Revisiones: manuales pendientes (solo admins)
    if (isAdmin) {
      try {
        const res = await api.get('/manual/pendientes')
        setTieneRevisiones((res.data.data || []).length > 0)
      } catch {}
    }
  }, [user, isAdmin])

  useEffect(() => { refresh() }, [location.pathname, refresh])

  return (
    <NotificationsContext.Provider value={{ tieneCheckin, tieneRevisiones, refresh }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
