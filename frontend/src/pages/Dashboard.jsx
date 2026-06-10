import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { Bot, BookText, CalendarCheck, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [progress, setProgress] = useState({})
  const [checkinStatus, setCheckinStatus] = useState({})
  const [loading, setLoading] = useState(true)

  const funciones = user?.funciones || []
  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  useEffect(() => {
    async function load() {
      try {
        await refreshUser()
        const [progRes, checkinRes] = await Promise.all([
          isAdmin ? api.get('/checkin/progreso') : Promise.resolve(null),
          api.get('/checkin/hoy')
        ])
        setProgress(isAdmin ? progRes.data.data : (checkinRes.data.entryCounts || {}))

        // Build map of function → completed today
        const todaySessions = checkinRes.data.data
        const statusMap = {}
        for (const s of todaySessions) {
          statusMap[s.funcion] = s.completado
        }
        setCheckinStatus(statusMap)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pendingCheckin = funciones.some(fn => !checkinStatus[fn])

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

      {/* Check-in banner */}
      {funciones.length > 0 && pendingCheckin && (
        <div
          onClick={() => navigate('/manual')}
          className="flex items-center gap-3 p-4 rounded-xl mb-6 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: '#fff8e1', border: '1px solid #f0d060' }}
        >
          <CalendarCheck className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-sm">Check-in diario pendiente</p>
            <p className="text-xs text-muted-foreground">Respondé las 3 preguntas de hoy para construir la base de conocimiento</p>
          </div>
          <ArrowRight size={16} className="text-amber-600 shrink-0" />
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
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: pendingCheckin ? '#fff8e1' : '#f0f7f0' }}
            >
              <BookText size={20} style={{ color: pendingCheckin ? '#c0922a' : '#1a3a1a' }} />
            </div>
            <div>
              <p className="font-semibold text-sm">Mi Manual</p>
              <p className="text-xs text-muted-foreground">
                {pendingCheckin ? 'Check-in pendiente hoy' : 'Check-in completado ✓'}
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
