import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import api, { getShared } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import CheckinBlock from '@/components/CheckinBlock'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { useTour } from '@/lib/tour'
import { Bot, BookText, HelpCircle, Loader2 } from 'lucide-react'

export default function Dashboard() {
  const { user, refreshUser } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const navigate = useNavigate()
  const [progress, setProgress] = useState({})
  const [todaySessions, setTodaySessions] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState({})
  const [dailyCounts, setDailyCounts] = useState({})
  const [primaryStatusMap, setPrimaryStatusMap] = useState({})
  const [cycleStatusMap, setCycleStatusMap] = useState({})
  const [checkinAvailabilityMap, setCheckinAvailabilityMap] = useState({})
  const [loading, setLoading] = useState(true)

  const funciones = user?.funciones || []
  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- carga inicial

  async function load() {
    try {
      // refreshUser no alimenta a las otras dos consultas, así que va en paralelo:
      // encadenarlo agregaba un viaje completo antes de empezar a pedir los datos.
      const [, progRes, checkin] = await Promise.all([
        refreshUser(),
        isAdmin ? api.get('/checkin/progreso') : Promise.resolve(null),
        getShared('/checkin/hoy')
      ])
      setProgress(isAdmin ? progRes.data.data : (checkin.entryCounts || {}))
      setTodaySessions(checkin.data || [])
      setOnboardingStatus(checkin.onboardingStatus || {})
      setDailyCounts(checkin.dailyCounts || {})
      setPrimaryStatusMap(checkin.primaryStatusMap || {})
      setCycleStatusMap(checkin.cycleStatusMap || {})
      setCheckinAvailabilityMap(checkin.checkinAvailabilityMap || {})
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  // El check-in puede responderse desde Inicio o Mi Manual. Una función queda pendiente
  // si el usuario es operativo principal y el backend confirma una tanda disponible.
  function checkinPendiente(fn) {
    if (primaryStatusMap[fn] === false) return false
    const cycle = cycleStatusMap[fn]
    if (!cycle || cycle.estado === 'completado') return false
    const session = sessionForFuncion(fn)
    if (session && !session.completado) return true
    return checkinAvailabilityMap[fn]?.estado === 'disponible'
  }

  function handleCheckinComplete() {
    load()
    refreshNotifications()
  }

  // Si el usuario está de vacaciones, nunca mostramos check-in pendiente
  const enVacaciones = !!user?.enVacaciones
  const funcionesPendientes = enVacaciones ? [] : funciones.filter(checkinPendiente)
  const pendingCheckin = funcionesPendientes.length > 0

  // Recorrido guiado de la pantalla. Los pasos cuyo elemento no está en el DOM
  // (ej: el check-in cuando ya se completó) se descartan solos.
  const { replay: verTour } = useTour({
    tourId: 'dashboard',
    userId: user?.id,
    listo: !loading && !!user,
    steps: [
      {
        popover: {
          title: `¡Hola, ${(user?.nombre || '').split(' ')[0]}! 👋`,
          description: 'REMI documenta el conocimiento de tu puesto a partir de preguntas cortas. Te muestro en 30 segundos cómo funciona.'
        }
      },
      {
        element: '[data-tour="checkin"]',
        popover: {
          title: 'Tu check-in del día',
          description: 'Acá respondés las preguntas de tu función. Cada ciclo tiene la cantidad y frecuencia configuradas por tu supervisor. Contestá las que puedas y tocá "Guardar respuestas". Si más tarde querés corregir algo, lo editás desde "Mi Manual".',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '[data-tour="manual"]',
        popover: {
          title: 'Tu manual',
          description: 'Con tus respuestas se arma solo el manual de tu puesto. Desde ahí lo generás o actualizás, editás respuestas puntuales y lo enviás a tu supervisor para aprobación.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="asistente"]',
        popover: {
          title: 'Asistente IA',
          description: 'Consultá procedimientos de la empresa con tus palabras. Responde en base a lo que ya está documentado.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="progreso"]',
        popover: {
          title: 'Tu progreso',
          description: 'Seguí cuántas respuestas lleva el ciclo de cada función. La meta es orientativa cuando el supervisor define una; él decide cuándo finalizar el relevamiento.',
          side: 'top'
        }
      }
    ]
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a3a1a' }}>
            Bienvenido, {user?.nombre} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={verTour}
          title="Ver cómo funciona"
          className="flex items-center justify-center shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <HelpCircle size={14} />
        </button>
      </div>

      {loading && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Cargando tus check-ins y progreso...
        </div>
      )}

      {/* Check-in del día */}
      {!loading && funcionesPendientes.length > 0 && (
        <div className="mb-6" data-tour="checkin">
          {funcionesPendientes.map(fn => (
            <CheckinBlock
              key={fn}
              funcion={fn}
              color={FUNC_COLORS[fn] || '#1a3a1a'}
              todaySession={sessionForFuncion(fn)}
              onboardingDone={!!onboardingStatus[fn]}
              diasCompletos={dailyCounts[fn] || 0}
              cycle={cycleStatusMap[fn]}
              onComplete={handleCheckinComplete}
              isPrimary={primaryStatusMap[fn] ?? true}
              preguntasPendientes={checkinAvailabilityMap[fn]?.preguntasPendientes || 0}
              permiteResponderTodas={checkinAvailabilityMap[fn]?.permiteResponderTodas ?? false}
            />
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card data-tour="asistente" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/asistente')}>
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
        <Card data-tour="manual" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manual')}>
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
        <Card data-tour="progreso">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Progreso de base de conocimiento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {funciones.map(fn => {
              const count = progress[fn] || 0
              const target = cycleStatusMap[fn]?.objetivoPreguntas
              const pct = target ? Math.min(100, Math.round((count / target) * 100)) : 0
              return (
                <div key={fn}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{FUNC_ICONS[fn]} {fn}</span>
                    <span className="text-muted-foreground">
                      {cycleStatusMap[fn] ? `Ciclo ${cycleStatusMap[fn].numero} · ` : ''}
                      {target ? `${count}/${target} respuestas · ${pct}%` : `${count} respuestas`}
                    </span>
                  </div>
                  {target && <Progress value={pct} indicatorClassName="transition-all" style={{ '--progress-color': FUNC_COLORS[fn] }} />}
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
