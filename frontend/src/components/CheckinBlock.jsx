import { useState, useEffect } from 'react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCw, BookOpen, CalendarCheck } from 'lucide-react'

// El ciclo 1 conserva las preguntas iniciales históricas. Después, cada tanda responde
// a la configuración y al plan aprobado por el supervisor.
export default function CheckinBlock({ funcion, color, todaySession, onboardingDone, diasCompletos, onComplete, isPrimary, cycle }) {
  const [session, setSession] = useState(todaySession)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(false)
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

  async function startCheckin() {
    setLoading(true)
    try {
      const res = await api.post('/checkin/iniciar', { funcion })
      setSession(res.data.data)
      setAnswers(res.data.data.preguntas.map(p => p.respuesta || ''))
    } catch (err) {
      alert(err.response?.data?.error || 'Error al iniciar check-in')
    } finally { setLoading(false) }
  }

  async function saveAnswers() {
    setSaving(true)
    try {
      await api.post(`/checkin/${session.id}/responder`, { respuestas: answers })
      setSession(prev => ({
        ...prev,
        completado: true,
        preguntas: prev.preguntas.map((p, i) => ({ ...p, respuesta: answers[i], respondida: true }))
      }))
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              {isOnboarding
                ? 'Respondé las 10 preguntas iniciales para documentar tu función.'
                : `Respondé la próxima tanda de ${cycle?.preguntasPorEntrega || 3} preguntas para seguir documentando tu función.`}
            </p>
            <Button
              onClick={startCheckin}
              disabled={loading}
              size="sm"
              className="gap-1.5 shrink-0"
              style={{ background: color, color: 'white' }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Iniciar
            </Button>
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
