import { useState, useEffect } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import {
  Loader2, Download, Send, Sparkles, ChevronDown, ChevronUp,
  Pencil, RefreshCw, BookOpen, CalendarCheck, CheckCircle2
} from 'lucide-react'

const LOGO_URL = 'https://res.cloudinary.com/dmigevwah/image/upload/f_png/v1777495745/don_emilio/don_emilio_logo'

const pdfStyles = StyleSheet.create({
  page: { padding: 48, paddingBottom: 72, fontFamily: 'Helvetica', fontSize: 10, color: '#222' },
  header: { marginBottom: 20, borderBottom: '1pt solid #1a3a1a', paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  logo: { height: 54, width: 180, objectFit: 'contain' },
  headerMeta: { textAlign: 'right', fontSize: 9, color: '#555', lineHeight: 1.5 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#1a3a1a' },
  bloque: { marginBottom: 16 },
  bloqueTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1a3a1a', marginBottom: 12 },
  bloqueText: { lineHeight: 0.95, textAlign: 'justify', color: '#333' },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 8, color: '#999', borderTop: '0.5pt solid #ddd', paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }
})

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
}

const ESTADO_LABELS = {
  borrador: { label: 'Borrador', bg: 'bg-amber-100', text: 'text-amber-800' },
  en_revision: { label: 'En revisión', bg: 'bg-blue-100', text: 'text-blue-800' },
  vigente: { label: 'Vigente', bg: 'bg-green-100', text: 'text-green-800' },
  obsoleto: { label: 'Obsoleto', bg: 'bg-gray-100', text: 'text-gray-500' }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
function ManualPDF({ funcion, contenido, generadoEn, version = 'Borrador' }) {
  const bloques = Object.entries(BLOQUE_NOMBRES)
    .filter(([key]) => contenido[key])
    .map(([key, nombre]) => ({ key, nombre, texto: contenido[key] }))
  const fecha = generadoEn
    ? new Date(generadoEn).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerRow}>
            <Image src={LOGO_URL} style={pdfStyles.logo} />
            <View style={pdfStyles.headerMeta}>
              <Text>Versión: {version}</Text>
              <Text>Generado: {fecha}</Text>
            </View>
          </View>
          <Text style={pdfStyles.title}>Manual de Puesto: {funcion}</Text>
        </View>
        {bloques.map(({ key, nombre, texto }) => (
          <View key={key} style={pdfStyles.bloque}>
            <Text style={pdfStyles.bloqueTitle}>{nombre}</Text>
            <Text style={pdfStyles.bloqueText}>{texto}</Text>
          </View>
        ))}
        <View style={pdfStyles.footer} fixed>
          <Text>Registro de Experiencia y Memoria Institucional (REMI) · Don Emilio</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ─── Check-in block ───────────────────────────────────────────────────────────
function CheckinBlock({ funcion, color, todaySession, onboardingDone, diasCompletos, onComplete }) {
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

  // Hidden once completed today
  if (session?.completado) return null

  const isOnboarding = session ? session.preguntas.length === 10 : !onboardingDone
  const PhaseIcon = isOnboarding ? BookOpen : CalendarCheck
  const phaseLabel = isOnboarding ? 'Preguntas iniciales' : `Día ${diasCompletos + 1} de 20`

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
    <div className="mb-5 rounded-xl border border-amber-200 overflow-hidden" style={{ background: '#fffbf0' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200" style={{ background: '#fff8e1' }}>
        <PhaseIcon size={14} className="text-amber-600" />
        <span className="text-xs font-semibold text-amber-800">Check-in de hoy · {phaseLabel}</span>
      </div>

      <div className="p-4">
        {/* No session started */}
        {!session && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              {!onboardingDone
                ? 'Respondé las 10 preguntas iniciales para documentar tu función.'
                : diasCompletos >= 20
                  ? '¡Completaste los 20 días de documentación!'
                  : 'Respondé las 3 preguntas de hoy para seguir documentando tu función.'}
            </p>
            {diasCompletos < 20 && (
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
            )}
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

// ─── Manual section ───────────────────────────────────────────────────────────
function ManualSection({ funcion, color }) {
  const [manual, setManual] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [showHistorial, setShowHistorial] = useState(false)
  const [showEnviarDialog, setShowEnviarDialog] = useState(false)
  const [notaEnvio, setNotaEnvio] = useState('')

  useEffect(() => { loadManual() }, [funcion])

  async function loadManual() {
    setLoading(true)
    try {
      const [manualRes, histRes] = await Promise.all([
        api.get(`/manual/${encodeURIComponent(funcion)}`),
        api.get(`/manual/${encodeURIComponent(funcion)}/historial`)
      ])
      setManual(manualRes.data.data)
      setHistorial(histRes.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function generarOActualizar() {
    setGenerating(true)
    try {
      const res = await api.post(`/manual/${encodeURIComponent(funcion)}/generar`)
      setManual(res.data.data)
      const histRes = await api.get(`/manual/${encodeURIComponent(funcion)}/historial`)
      setHistorial(histRes.data.data || [])
    } catch (err) {
      alert(err.response?.data?.error || 'Error al generar el manual')
    } finally { setGenerating(false) }
  }

  async function enviarAAprobacion() {
    setSending(true)
    try {
      const res = await api.post(`/manual/${encodeURIComponent(funcion)}/enviar`, { nota: notaEnvio })
      setManual(res.data.data)
      setShowEnviarDialog(false)
      setNotaEnvio('')
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar')
    } finally { setSending(false) }
  }

  async function exportarPDF() {
    if (!manual?.contenido) return
    setExporting(true)
    try {
      const blob = await pdf(
        <ManualPDF funcion={funcion} contenido={manual.contenido} generadoEn={manual.generadoEn} version={manual.version} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `manual-${funcion.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al exportar el PDF')
    } finally { setExporting(false) }
  }

  const bloques = manual?.contenido
    ? Object.entries(BLOQUE_NOMBRES).filter(([key]) => manual.contenido[key])
    : []
  const estadoInfo = manual ? (ESTADO_LABELS[manual.estado] || ESTADO_LABELS.borrador) : null
  const versionesAnteriores = historial.filter(h => h.estado === 'obsoleto')

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color }}>Manual de puesto</h2>
          {manual && (
            <>
              <span className="text-xs font-medium text-muted-foreground">{manual.version}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoInfo.bg} ${estadoInfo.text}`}>
                {estadoInfo.label}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {manual?.estado !== 'en_revision' && (
            <Button size="sm" onClick={generarOActualizar} disabled={generating} className="gap-1 text-xs h-7" style={{ background: color, color: 'white' }}>
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {manual ? 'Actualizar' : 'Generar manual'}
            </Button>
          )}
          {manual && (
            <>
              <Button size="sm" variant="outline" onClick={exportarPDF} disabled={exporting} className="gap-1 text-xs h-7">
                {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                PDF
              </Button>
              {manual.estado === 'borrador' && (
                <Button size="sm" variant="outline" onClick={() => setShowEnviarDialog(true)} className="gap-1 text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Send size={12} />
                  Enviar a aprobación
                </Button>
              )}
              {manual.estado === 'en_revision' && (
                <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-lg">
                  Aguardando revisión...
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando...</p>}

      {!loading && !manual && (
        <p className="text-sm text-muted-foreground">
          Aún no se generó el manual. Completá el check-in y luego hacé click en "Generar manual".
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

          {manual.observaciones && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-orange-700 mb-1">Observaciones del revisor:</p>
              <p className="text-xs text-orange-800">{manual.observaciones}</p>
            </div>
          )}

          {versionesAnteriores.length > 0 && (
            <div className="mt-2">
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistorial(v => !v)}
              >
                {showHistorial ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {versionesAnteriores.length} {versionesAnteriores.length > 1 ? 'versiones' : 'versión'} anterior{versionesAnteriores.length > 1 ? 'es' : ''}
              </button>
              {showHistorial && (
                <div className="mt-2 flex flex-col gap-1.5 pl-2 border-l-2 border-muted">
                  {versionesAnteriores.map(v => (
                    <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ESTADO_LABELS.obsoleto.bg} ${ESTADO_LABELS.obsoleto.text}`}>
                        {v.version}
                      </span>
                      <span>{new Date(v.generadoEn || v.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={showEnviarDialog} onOpenChange={setShowEnviarDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar manual a aprobación</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tu manual de <strong>{funcion}</strong> (v{manual?.version}) será enviado a tu supervisor para revisión. No podrás editarlo hasta recibir respuesta.
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">Nota para el revisor (opcional)</label>
            <Textarea placeholder="Agregá contexto o comentarios relevantes..." value={notaEnvio} onChange={e => setNotaEnvio(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEnviarDialog(false); setNotaEnvio('') }}>Cancelar</Button>
            <Button onClick={enviarAAprobacion} disabled={sending} className="gap-1" style={{ background: color, color: 'white' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Entries section ──────────────────────────────────────────────────────────
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
    <div className="mt-5 pt-4 border-t">
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
                  <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} autoFocus className="text-sm" />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => saveEdit(entry.id)} disabled={saving} className="text-xs h-7 gap-1" style={{ background: color, color: 'white' }}>
                      {saving && <Loader2 size={11} className="animate-spin" />}
                      Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="text-xs h-7">Cancelar</Button>
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
                    <button onClick={() => { setEditingId(entry.id); setEditContent(entry.contenido) }} className="p-1 text-muted-foreground hover:text-foreground shrink-0 transition-colors">
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

// ─── Mi Manual page ───────────────────────────────────────────────────────────
export default function MiManual() {
  const { user, refreshUser } = useAuth()
  const funciones = user?.funciones || []
  const [selectedFn, setSelectedFn] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [todaySessions, setTodaySessions] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState({})
  const [dailyCounts, setDailyCounts] = useState({})
  const [entryCounts, setEntryCounts] = useState({})
  const [refreshEntries, setRefreshEntries] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const fresh = await refreshUser()
      const fns = fresh?.funciones || []
      setSelectedFn(prev => prev || fns[0] || '')
      const res = await api.get('/checkin/hoy')
      setTodaySessions(res.data.data || [])
      setOnboardingStatus(res.data.onboardingStatus || {})
      setDailyCounts(res.data.dailyCounts || {})
      setEntryCounts(res.data.entryCounts || {})
    } catch { /* ignore */ }
    finally { setInitializing(false) }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  function checkinPendiente(fn) {
    return !sessionForFuncion(fn)?.completado
  }

  function handleCheckinComplete() {
    load()
    setRefreshEntries(n => n + 1)
  }

  if (initializing) {
    return <div className="max-w-3xl mx-auto p-6"><p className="text-muted-foreground text-sm">Cargando...</p></div>
  }

  if (funciones.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No tenés funciones asignadas. Pedile al administrador que te asigne una.
          </CardContent>
        </Card>
      </div>
    )
  }

  const color = FUNC_COLORS[selectedFn] || '#1a3a1a'
  const pct = Math.min(100, Math.round(((entryCounts[selectedFn] || 0) / 60) * 100))

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Mi Manual</h1>
        <p className="text-sm text-muted-foreground">Documentación de tu puesto</p>
      </div>

      {/* Function tabs */}
      {funciones.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {funciones.map(fn => {
            const pending = checkinPendiente(fn)
            return (
              <button
                key={fn}
                onClick={() => setSelectedFn(fn)}
                className="relative text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                style={selectedFn === fn
                  ? { background: FUNC_COLORS[fn] || '#1a3a1a', color: 'white', borderColor: FUNC_COLORS[fn] || '#1a3a1a' }
                  : { background: 'transparent', color: '#666', borderColor: '#ddd' }
                }
              >
                {FUNC_ICONS[fn]} {fn}
                {pending && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{entryCounts[selectedFn] || 0}/60 · {pct}% documentado</span>
      </div>

      <Card>
        <CardContent className="p-5">
          {/* 1 — Check-in block (disappears when done) */}
          <CheckinBlock
            key={selectedFn}
            funcion={selectedFn}
            color={color}
            todaySession={sessionForFuncion(selectedFn)}
            onboardingDone={!!onboardingStatus[selectedFn]}
            diasCompletos={dailyCounts[selectedFn] || 0}
            onComplete={handleCheckinComplete}
          />

          {/* 2 — Manual */}
          <ManualSection funcion={selectedFn} color={color} />

          {/* 3 — Previous answers */}
          {onboardingStatus[selectedFn] && (
            <EntradasSection funcion={selectedFn} color={color} refreshTrigger={refreshEntries} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
