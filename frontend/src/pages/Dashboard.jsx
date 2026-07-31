import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import api from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import CheckinBlock from '@/components/CheckinBlock'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { Bot, BookText } from 'lucide-react'

export default function Dashboard() {
  const { user, refreshUser } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const navigate = useNavigate()
  const [progress, setProgress] = useState({})
  const [todaySessions, setTodaySessions] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState({})
  const [dailyCounts, setDailyCounts] = useState({})
  const [primaryStatusMap, setPrimaryStatusMap] = useState({})
  const [loading, setLoading] = useState(true)

  const funciones = user?.funciones || []
  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      await refreshUser()
      const [progRes, checkinRes] = await Promise.all([
        isAdmin ? api.get('/checkin/progreso') : Promise.resolve(null),
        api.get('/checkin/hoy')
      ])
      setProgress(isAdmin ? progRes.data.data : (checkinRes.data.entryCounts || {}))
      setTodaySessions(checkinRes.data.data || [])
      setOnboardingStatus(checkinRes.data.onboardingStatus || {})
      setDailyCounts(checkinRes.data.dailyCounts || {})
      setPrimaryStatusMap(checkinRes.data.primaryStatusMap || {})
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  // El check-in se responde únicamente desde acá (Inicio). Una función queda pendiente
  // si el usuario es ocupante principal, no completó la sesión de hoy y no agotó los 20 días.
  function checkinPendiente(fn) {
    if (primaryStatusMap[fn] === false) return false
    if ((dailyCounts[fn] || 0) >= 20) return false
    return !sessionForFuncion(fn)?.completado
  }

  function handleCheckinComplete() {
    load()
    refreshNotifications()
  }

  // Si el usuario está de vacaciones, nunca mostramos check-in pendiente
  const enVacaciones = !!user?.enVacaciones
  const funcionesPendientes = enVacaciones ? [] : funciones.filter(checkinPendiente)
  const pendingCheckin = funcionesPendientes.length > 0

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1a3a1a' }}>
          Bienvenido, {user?.nombre} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Check-in del día — se responde únicamente desde acá */}
      {!loading && funcionesPendientes.length > 0 && (
        <div className="mb-6">
          {funcionesPendientes.map(fn => (
            <CheckinBlock
              key={fn}
              funcion={fn}
              color={FUNC_COLORS[fn] || '#1a3a1a'}
              todaySession={sessionForFuncion(fn)}
              onboardingDone={!!onboardingStatus[fn]}
              diasCompletos={dailyCounts[fn] || 0}
              onComplete={handleCheckinComplete}
              isPrimary={primaryStatusMap[fn] ?? true}
            />
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/asistente')}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#f0f7f0' }}>
              <Bot size={20} style={{ color: '#1a3a1a' }} />
            </div>
            <div>
              <p className="font-semibold text-sm">Asistente IA</p>
              <p className="text-xs text-muted-foreground">Consultá procedimientos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manual')}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#f0f7f0' }}>
              <BookText size={20} style={{ color: '#1a3a1a' }} />
            </div>
            <div>
              <p className="font-semibold text-sm">Mi Manual</p>
              <p className="text-xs text-muted-foreground">
                {pendingCheckin ? 'Documentación de tu puesto' : 'Check-in al día ✓'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Functions progress */}
      {funciones.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Progreso de base de conocimiento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {funciones.map(fn => {
              const count = progress[fn] || 0
              const pct = Math.min(100, Math.round((count / 60) * 100))
              return (
                <div key={fn}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{FUNC_ICONS[fn]} {fn}</span>
                    <span className="text-muted-foreground">{count}/60 · {pct}%</span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName="transition-all"
                    style={{ '--progress-color': FUNC_COLORS[fn] }}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {funciones.length === 0 && !isAdmin && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>No tenés funciones asignadas todavía.</p>
            <p className="text-sm mt-1">Contactá al administrador para que te asigne una función.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
