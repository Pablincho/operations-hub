import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { CheckCircle2, Loader2, RefreshCw, BookOpen, CalendarCheck, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const META_ENTRADAS = 60

// ─── EntradasSection ──────────────────────────────────────────────────────────
function EntradasSection({ funcion, color, refreshTrigger }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEntries() }, [funcion, refreshTrigger])

  async function loadEntries() {
    setLoading(true)
    try {
      const res = await api.get('/knowledge', { params: { funcion, categoria: 'checkin' } })
      setEntries(res.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function saveEdit(id) {
    setSaving(true)
    try {
      await api.put(`/knowledge/${id}`, { contenido: editContent })
      setEntries(prev => prev.map(e => e.id === id ? { ...e, contenido: editContent } : e))
      setEditingId(null)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  if (!loading && entries.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t">
      <button
        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ color }}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {loading ? 'Cargando respuestas...' : `${entries.length} respuestas documentadas`}
      </button>

      {expanded && !loading && (
        <div className="mt-3 flex flex-col gap-2">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-lg p-3" style={{ background: '#f9faf9' }}>
              <p className="text-xs font-semibold mb-1" style={{ color }}>{entry.titulo}</p>
              {editingId === entry.id ? (
                <div>
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    autoFocus
                    className="text-sm"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(entry.id)}
                      disabled={saving}
                      className="text-xs h-7 gap-1"
                      style={{ background: color, color: 'white' }}
                    >
                      {saving && <Loader2 size={11} className="animate-spin" />}
                      Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="text-xs h-7">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1 leading-relaxed">
                    {entry._bloqueado
                      ? <span className="text-muted-foreground italic">🔒 Información sensible restringida</span>
                      : entry.contenido}
                  </p>
                  {!entry._bloqueado && (
                    <button
                      onClick={() => { setEditingId(entry.id); setEditContent(entry.contenido) }}
                      className="p-1 text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CheckinFuncion ───────────────────────────────────────────────────────────
function CheckinFuncion({ funcion, todaySession, onboardingDone, diasCompletos, entryCount, onComplete }) {
  const [session, setSession] = useState(todaySession)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshEntries, setRefreshEntries] = useState(0)

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
    } finally { setLoading(false) }
  }

  async function saveAnswers() {
    setSaving(true)
    try {
      await api.post(`/checkin/${session.id}/responder`, { respuestas: answers })
      const updated = {
        ...session,
        completado: true,
        preguntas: session.preguntas.map((p, i) => ({ ...p, respuesta: answers[i], respondida: true }))
      }
      setSession(updated)
      setRefreshEntries(n => n + 1)
      onComplete?.()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar respuestas')
    } finally { setSaving(false) }
  }

  const color = FUNC_COLORS[funcion]
  const icon = FUNC_ICONS[funcion]
  const isOnboarding = session ? session.preguntas.length === 10 : !onboardingDone
  const phaseLabel = isOnboarding ? 'Preguntas iniciales' : `Día ${diasCompletos + 1} de 20`
  const PhaseIcon = isOnboarding ? BookOpen : CalendarCheck
  const pct = Math.min(100, Math.round((entryCount / META_ENTRADAS) * 100))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4 pb-0" style={{ background: color }}>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {icon} {funcion}
          <span className="ml-auto flex items-center gap-1 text-xs font-normal opacity-80">
            <PhaseIcon size={13} />
            {phaseLabel}
          </span>
          {session?.completado && <CheckCircle2 size={16} className="text-green-300" />}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2 pb-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white/80 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-white/80 shrink-0">{pct}% documentado</span>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* No session yet */}
        {!session && (
          <div className="text-center py-4">
            {!onboardingDone ? (
              <>
                <p className="text-sm font-medium mb-1" style={{ color }}>Onboarding pendiente</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Respondé las 10 preguntas iniciales para documentar tu función.
                </p>
                <Button onClick={startCheckin} disabled={loading} className="gap-2" style={{ background: color, color: 'white' }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Iniciar preguntas iniciales
                </Button>
              </>
            ) : diasCompletos >= 20 ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-green-500" />
                <p className="text-sm font-medium text-green-700">¡Check-in completo!</p>
                <p className="text-xs text-muted-foreground">Completaste los 20 días de documentación.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">No iniciaste el check-in de hoy</p>
                <Button onClick={startCheckin} disabled={loading} className="gap-2" style={{ background: color, color: 'white' }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Generar preguntas del día
                </Button>
              </>
            )}
          </div>
        )}

        {/* Session completed */}
        {session?.completado && (
          <div className="flex flex-col gap-3">
            {session.preguntas.map((p, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: '#f9faf9' }}>
                <p className="text-xs font-semibold mb-1" style={{ color }}>{i + 1}. {p.pregunta}</p>
                <p className="text-sm">{p.respuesta || <span className="text-muted-foreground">Sin respuesta</span>}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
              <CheckCircle2 size={16} />
              {isOnboarding ? 'Onboarding completado ✓ Mañana empieza el check-in diario' : 'Check-in completado hoy'}
            </div>
          </div>
        )}

        {/* Session in progress */}
        {session && !session.completado && (
          <div className="flex flex-col gap-4">
            {isOnboarding && (
              <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
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
              {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Guardar respuestas
            </Button>
          </div>
        )}

        {/* Previous answers — always visible once onboarding is done */}
        {onboardingDone && (
          <EntradasSection funcion={funcion} color={color} refreshTrigger={refreshEntries} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Checkin page ─────────────────────────────────────────────────────────────
export default function Checkin() {
  const { user } = useAuth()
  const [todaySessions, setTodaySessions] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState({})
  const [dailyCounts, setDailyCounts] = useState({})
  const [entryCounts, setEntryCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const funciones = user?.funciones || []

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/checkin/hoy')
      setTodaySessions(res.data.data)
      setOnboardingStatus(res.data.onboardingStatus || {})
      setDailyCounts(res.data.dailyCounts || {})
      setEntryCounts(res.data.entryCounts || {})
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  const completedToday = funciones.filter(fn => sessionForFuncion(fn)?.completado).length
  const pendingOnboarding = funciones.filter(fn => !onboardingStatus[fn]).length

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Check-in</h1>
        <p className="text-sm text-muted-foreground">
          {completedToday}/{funciones.length} completadas hoy ·{' '}
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {pendingOnboarding > 0 && (
          <p className="text-xs mt-1 text-amber-700">
            {pendingOnboarding === 1 ? '1 función pendiente de onboarding' : `${pendingOnboarding} funciones pendientes de onboarding`}
          </p>
        )}
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
              onboardingDone={!!onboardingStatus[fn]}
              diasCompletos={dailyCounts[fn] || 0}
              entryCount={entryCounts[fn] || 0}
              onComplete={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
