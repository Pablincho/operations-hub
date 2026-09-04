import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getShared } from '@/services/api'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext({ tieneCheckin: false, tieneRevisiones: false })

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const [tieneCheckin, setTieneCheckin] = useState(false)
  const [tieneRevisiones, setTieneRevisiones] = useState(false)

  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  // refreshUser() devuelve un objeto nuevo en cada llamada, así que depender de `user`
  // cambiaba la identidad de refresh y volvía a disparar el efecto: cada pantalla pedía
  // todo dos veces. Con valores primitivos, si no cambió nada real el efecto no corre.
  const userId = user?.id || null
  const enVacaciones = !!user?.enVacaciones
  const funcionesKey = (user?.funciones || []).join('|')

  const refresh = useCallback(async () => {
    if (!userId) return

    // Mi Manual: check-in pendiente en alguna función donde el usuario es ocupante principal.
    // Si está de vacaciones, no se muestra notificación.
    try {
      if (enVacaciones) {
        setTieneCheckin(false)
      } else {
        const payload = await getShared('/checkin/hoy')
        const { data: sessions = [], primaryStatusMap = {}, cycleStatusMap = {} } = payload
        const funciones = funcionesKey ? funcionesKey.split('|') : []
        const pendiente = funciones.some(fn => {
          if (primaryStatusMap[fn] === false) return false
          const cycle = cycleStatusMap[fn]
          if (!cycle || cycle.estado === 'completado') return false
          if (cycle.estado !== 'relevamiento' && !(cycle.esLegacy && cycle.estado === 'configuracion')) return false
          const sesionHoy = sessions.find(s => s.funcion === fn)
          return !sesionHoy?.completado
        })
        setTieneCheckin(pendiente)
      }
    } catch {}

    // Revisiones: manuales pendientes (solo admins)
    if (isAdmin) {
      try {
        const [manuales, puestos] = await Promise.all([
          getShared('/manual/pendientes'),
          getShared('/manual-cycles/puestos')
        ])
        const pendingManuals = (manuales.data || []).length > 0
        const pendingQuestions = (puestos.data || []).some(position =>
          (position.ciclo?.conteoPreguntas?.propuesta || 0) > 0
        )
        setTieneRevisiones(pendingManuals || pendingQuestions)
      } catch {}
    }
  }, [userId, enVacaciones, funcionesKey, isAdmin])

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
