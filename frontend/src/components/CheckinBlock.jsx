import { useState, useEffect } from 'react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw, BookOpen, CalendarCheck, ListChecks } from 'lucide-react'

// El ciclo 1 conserva las preguntas iniciales históricas. Después, cada tanda responde
// a la configuración y al plan aprobado por el supervisor.
export default function CheckinBlock({ funcion, color, todaySession, onboardingDone, diasCompletos, onComplete, isPrimary, cycle, preguntasPendientes = 0, permiteResponderTodas = false }) {
  const [session, setSession] = useState(todaySession)
  const [answers, setAnswers] = useState([])
  const [loadingMode, setLoadingMode] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (todaySession) {
      setSession(todaySession)
      setAnswers(todaySession.preguntas.map(p => p.respuesta || ''))
    }
  }, [todaySession])

  // Hidden once completed today or when user is a read-only secondary occupant
  if (session?.completado) return null
  if (isPrimary === false) return null

  const isOnboarding = !!cycle?.esLegacy && (session ? session.preguntas.length === 10 : !onboardingDone)
  const PhaseIcon = isOnboarding ? BookOpen : CalendarCheck
  const phaseLabel = isOnboarding ? 'Preguntas iniciales' : `Ciclo ${cycle?.numero || 1} · tanda ${diasCompletos + 1}`
  const preguntasPorTanda = cycle?.preguntasPorEntrega || 3
  const preguntasEnProximaTanda = Math.min(preguntasPendientes, preguntasPorTanda)

  async function startCheckin(todasPendientes = false) {
    setLoadingMode(todasPendientes ? 'todas' : 'tanda')
    try {
      const res = await api.post('/checkin/iniciar', { funcion, todasPendientes }, {
        agentActivity: {
          titulo: 'Preparando la tanda',
          descripcion: 'El sistema está seleccionando y, si hace falta, preparando las preguntas del ciclo.'
        }
      })
      setSession(res.data.data)
      setAnswers(res.data.data.preguntas.map(p => p.respuesta || ''))
    } catch (err) {
      alert(err.response?.data?.error || 'Error al iniciar check-in')
    } finally { setLoadingMode('') }
  }

  async function saveAnswers() {
    setSaving(true)
    try {
      await api.post(`/checkin/${session.id}/responder`, { respuestas: answers }, {
        agentActivity: {
          titulo: 'Procesando tus respuestas',
          descripcion: 'Guardamos las respuestas y, si el ciclo se completó, los agentes generarán el manual para revisión.'
        }
      })
      // Una sesión completada no bloquea la siguiente tanda: el padre recarga la
      // disponibilidad y, si quedan preguntas aprobadas, vuelve a mostrar el inicio.
      setSession(null)
      setAnswers([])
      onComplete?.()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar respuestas')
    } finally { setSaving(false) }
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 overflow-hidden" style={{ background: '#fffbf0' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200" style={{ background: '#fff8e1' }}>
        <PhaseIcon size={14} className="text-amber-600" />
        <span className="text-xs font-semibold text-amber-800">
          {funcion} · Check-in de hoy · {phaseLabel}
        </span>
      </div>

      <div className="p-4">
        {/* No session started */}
        {!session && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-52">
              <p className="text-sm text-amber-900">
                {isOnboarding
                  ? 'Respondé las 10 preguntas iniciales para documentar tu función.'
                  : preguntasEnProximaTanda === 1
                    ? 'Respondé la pregunta pendiente para seguir documentando tu función.'
                    : `Respondé la próxima tanda de ${preguntasEnProximaTanda || preguntasPorTanda} preguntas para seguir documentando tu función.`}
              </p>
              {permiteResponderTodas && !isOnboarding && preguntasPendientes > preguntasPorTanda && (
                <p className="mt-1 text-xs text-amber-700">Hay {preguntasPendientes} preguntas pendientes. Podés responder la tanda habitual o todas ahora.</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => startCheckin(false)}
                disabled={!!loadingMode}
                size="sm"
                className="gap-1.5 shrink-0"
                style={{ background: color, color: 'white' }}
              >
                {loadingMode === 'tanda' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {loadingMode === 'tanda' ? 'Preparando...' : preguntasEnProximaTanda === 1 ? 'Responder pregunta' : 'Iniciar tanda'}
              </Button>
              {permiteResponderTodas && !isOnboarding && preguntasPendientes > preguntasPorTanda && (
                <Button
                  onClick={() => startCheckin(true)}
                  disabled={!!loadingMode}
                  size="sm"
                  variant="outline"
                  title="Incluye todas las preguntas aprobadas que todavía no respondiste en este ciclo."
                  className="gap-1.5 shrink-0"
                >
                  {loadingMode === 'todas' ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
                  {loadingMode === 'todas' ? 'Preparando...' : 'Responder todas'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Session in progress */}
        {session && !session.completado && (
          <div className="flex flex-col gap-4">
            {isOnboarding && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                📋 Estas son las preguntas iniciales de tu función. Solo las hacemos una vez.
              </p>
            )}
            {session.preguntas.map((p, i) => (
              <div key={i}>
                <label className="text-xs font-semibold block mb-1" style={{ color }}>
                  {i + 1}. {p.pregunta}
                </label>
                <Textarea
                  value={answers[i] || ''}
                  onChange={e => {
                    const copy = [...answers]
                    copy[i] = e.target.value
                    setAnswers(copy)
                  }}
                  rows={isOnboarding ? 2 : 3}
                  placeholder="Tu respuesta..."
                />
              </div>
            ))}
            <Button
              onClick={saveAnswers}
              disabled={saving || answers.every(a => !a?.trim())}
              style={{ background: color, color: 'white' }}
            >
              {saving && <Loader2 size={14} className="animate-spin mr-2" />}
              Guardar respuestas
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
