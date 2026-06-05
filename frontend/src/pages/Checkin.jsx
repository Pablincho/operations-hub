import { useState, useEffect } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { CheckCircle2, Loader2, RefreshCw, BookOpen, CalendarCheck, FileText, Download, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

// ─── PDF styles ───────────────────────────────────────────────────────────────
const pdfStyles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#222' },
  header: { marginBottom: 24, borderBottom: '1pt solid #1a3a1a', paddingBottom: 12 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a3a1a', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  bloque: { marginBottom: 18 },
  bloqueTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1a3a1a', marginBottom: 6 },
  bloqueText: { lineHeight: 1.6, color: '#333' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: '#999', borderTop: '0.5pt solid #ddd', paddingTop: 8 }
})

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
}

function ManualPDF({ funcion, contenido, generadoEn }) {
  const bloques = Object.entries(BLOQUE_NOMBRES)
    .filter(([key]) => contenido[key])
    .map(([key, nombre]) => ({ key, nombre, texto: contenido[key] }))

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>Manual de Puesto — {funcion}</Text>
          <Text style={pdfStyles.subtitle}>
            Don Emilio · Generado el {generadoEn ? new Date(generadoEn).toLocaleDateString('es-AR') : '—'} · Versión 1.0 · Estado: Borrador
          </Text>
        </View>
        {bloques.map(({ key, nombre, texto }) => (
          <View key={key} style={pdfStyles.bloque}>
            <Text style={pdfStyles.bloqueTitle}>{nombre}</Text>
            <Text style={pdfStyles.bloqueText}>{texto}</Text>
          </View>
        ))}
        <View style={pdfStyles.footer}>
          <Text>MIRO — Sistema de Documentación Operativa · Don Emilio</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── ManualView ───────────────────────────────────────────────────────────────
function ManualView({ funcion, color, onClose }) {
  const [manual, setManual] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadManual() }, [funcion])

  async function loadManual() {
    setLoading(true)
    try {
      const res = await api.get(`/manual/${encodeURIComponent(funcion)}`)
      setManual(res.data.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function generarOActualizar() {
    setGenerating(true)
    try {
      const res = await api.post(`/manual/${encodeURIComponent(funcion)}/generar`)
      setManual(res.data.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al generar el manual')
    } finally { setGenerating(false) }
  }

  async function exportarPDF() {
    if (!manual?.contenido) return
    setExporting(true)
    try {
      const blob = await pdf(
        <ManualPDF funcion={funcion} contenido={manual.contenido} generadoEn={manual.generadoEn} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `manual-${funcion.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al exportar el PDF')
    } finally { setExporting(false) }
  }

  const bloques = manual?.contenido
    ? Object.entries(BLOQUE_NOMBRES).filter(([key]) => manual.contenido[key])
    : []

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color }}>Manual de puesto</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={generarOActualizar}
            disabled={generating}
            className="gap-1 text-xs h-7"
            style={{ background: color, color: 'white' }}
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {manual ? 'Actualizar' : 'Generar manual'}
          </Button>
          {manual && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportarPDF}
              disabled={exporting}
              className="gap-1 text-xs h-7"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              PDF
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando...</p>}

      {!loading && !manual && (
        <p className="text-xs text-muted-foreground">
          Aún no se generó el manual. Hacé click en "Generar manual" para crearlo a partir de tus respuestas del check-in.
        </p>
      )}

      {!loading && manual && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground mb-1">
            Última generación: {new Date(manual.generadoEn).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {bloques.map(([key, nombre]) => (
            <div key={key} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left hover:bg-muted/50 transition-colors"
                style={{ color }}
                onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}
              >
                {nombre}
                {expanded[key] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {expanded[key] && (
                <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-t bg-muted/20">
                  {manual.contenido[key]}
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
function CheckinFuncion({ funcion, todaySession, onboardingDone, diasCompletos, onComplete }) {
  const [session, setSession] = useState(todaySession)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showManual, setShowManual] = useState(false)

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
      const updated = {
        ...session,
        completado: true,
        preguntas: session.preguntas.map((p, i) => ({ ...p, respuesta: answers[i], respondida: true }))
      }
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
  const isOnboarding = session ? session.preguntas.length === 10 : !onboardingDone
  const phaseLabel = isOnboarding ? 'Preguntas iniciales' : `Día ${diasCompletos + 1} de 20`
  const PhaseIcon = isOnboarding ? BookOpen : CalendarCheck

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4" style={{ background: color }}>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {icon} {funcion}
          <span className="ml-auto flex items-center gap-1 text-xs font-normal opacity-80">
            <PhaseIcon size={13} />
            {phaseLabel}
          </span>
          {session?.completado && <CheckCircle2 size={16} className="text-green-300" />}
        </CardTitle>
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

        {/* Manual section — visible when onboarding is done */}
        {onboardingDone && (
          <div className="mt-3">
            <button
              className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color }}
              onClick={() => setShowManual(v => !v)}
            >
              <FileText size={13} />
              {showManual ? 'Ocultar manual' : 'Ver manual de puesto'}
              {showManual ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showManual && <ManualView funcion={funcion} color={color} />}
          </div>
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
              onComplete={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
