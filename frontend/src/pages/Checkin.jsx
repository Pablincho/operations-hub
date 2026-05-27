import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { CheckCircle2, Circle, Loader2, RefreshCw } from 'lucide-react'

function CheckinFuncion({ funcion, todaySession, onComplete }) {
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

  async function startCheckin() {
    setLoading(true)
    try {
      const res = await api.post('/checkin/iniciar', { funcion })
      setSession(res.data.data)
      setAnswers(res.data.data.preguntas.map(p => p.respuesta || ''))
    } catch (err) {
      alert(err.response?.data?.error || 'Error al iniciar check-in')
    } finally {
      setLoading(false)
    }
  }

  async function saveAnswers() {
    setSaving(true)
    try {
      await api.post(`/checkin/${session.id}/responder`, { respuestas: answers })
      const updated = { ...session, completado: true, preguntas: session.preguntas.map((p, i) => ({ ...p, respuesta: answers[i], respondida: true })) }
      setSession(updated)
      onComplete?.()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar respuestas')
    } finally {
      setSaving(false)
    }
  }

  const color = FUNC_COLORS[funcion]
  const icon = FUNC_ICONS[funcion]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4" style={{ background: color }}>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {icon} {funcion}
          {session?.completado && <CheckCircle2 size={16} className="ml-auto text-green-300" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {!session && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No iniciaste el check-in de hoy</p>
            <Button onClick={startCheckin} disabled={loading} className="gap-2" style={{ background: color, color: 'white' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Generar preguntas del día
            </Button>
          </div>
        )}

        {session && session.completado && (
          <div className="flex flex-col gap-3">
            {session.preguntas.map((p, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: '#f9faf9' }}>
                <p className="text-xs font-semibold mb-1" style={{ color }}>{p.pregunta}</p>
                <p className="text-sm">{p.respuesta || <span className="text-muted-foreground">Sin respuesta</span>}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
              <CheckCircle2 size={16} />
              Check-in completado hoy
            </div>
          </div>
        )}

        {session && !session.completado && (
          <div className="flex flex-col gap-4">
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
                  rows={3}
                  placeholder="Tu respuesta..."
                />
              </div>
            ))}
            <Button
              onClick={saveAnswers}
              disabled={saving || answers.every(a => !a?.trim())}
              style={{ background: color, color: 'white' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Guardar respuestas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Checkin() {
  const { user } = useAuth()
  const [todaySessions, setTodaySessions] = useState([])
  const [loading, setLoading] = useState(true)
  const funciones = user?.funciones || []

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/checkin/hoy')
      setTodaySessions(res.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  const completedCount = funciones.filter(fn => sessionForFuncion(fn)?.completado).length

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Check-in Diario</h1>
        <p className="text-sm text-muted-foreground">
          {completedCount}/{funciones.length} funciones completadas hoy ·{' '}
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : funciones.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No tenés funciones asignadas. Pedile al administrador que te asigne una.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {funciones.map(fn => (
            <CheckinFuncion
              key={fn}
              funcion={fn}
              todaySession={sessionForFuncion(fn)}
              onComplete={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
