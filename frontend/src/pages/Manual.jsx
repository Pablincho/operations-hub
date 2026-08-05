import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { diffWords } from 'diff'
import { pdf } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { useTour } from '@/lib/tour'
import {
  Loader2, Download, Send, Sparkles, ChevronDown, ChevronUp,
  Pencil, CheckCircle2, RotateCcw, X, GitCompare, FileText, CalendarCheck, ArrowRight, HelpCircle
} from 'lucide-react'

const LOGO_URL = 'https://res.cloudinary.com/dmigevwah/image/upload/f_png/v1777495745/don_emilio/don_emilio_logo'

const pdfStyles = StyleSheet.create({
  page: { padding: 48, paddingBottom: 72, fontFamily: 'Helvetica', fontSize: 10, color: '#222' },
  // Control documental: compact single-line header
  docControlBar: { borderBottom: '0.5pt solid #ddd', paddingBottom: 5, marginBottom: 14 },
  docControlText: { fontSize: 7.5, color: '#aaa' },
  header: { marginBottom: 16, borderBottom: '1pt solid #1a3a1a', paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  logo: { height: 54, width: 180, objectFit: 'contain' },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#1a3a1a' },
  // Grilla para firma (reutilizada)
  b0Grid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  b0Cell: { flex: 1 },
  b0Label: { fontSize: 7.5, color: '#888', marginBottom: 1 },
  b0Value: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#333' },
  // B1: Identificación
  b1Box: { marginBottom: 16 },
  b1Row: { flexDirection: 'row', marginBottom: 3 },
  b1Label: { fontSize: 9, color: '#888', width: 110 },
  b1Value: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#333', flex: 1 },
  // Bloques B2-B6
  bloque: { marginBottom: 20, minPresenceAhead: 0 },
  bloqueTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1a3a1a', marginBottom: 16 },
  bloqueText: { lineHeight: 1.2, textAlign: 'justify', color: '#333' },
  // Historial
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a3a1a', borderRadius: 2, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 2 },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#e8d5a3' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottom: '0.5pt solid #eee' },
  tableRowAlt: { backgroundColor: '#f5f7f5' },
  tableCell: { fontSize: 9, color: '#444' },
  // Firma digital
  firmaBox: { marginTop: 20, borderTop: '1pt solid #1a3a1a', paddingTop: 12 },
  firmaTitulo: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1a3a1a', marginBottom: 6 },
  firmaNote: { fontSize: 7, color: '#888', marginTop: 6 },
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

const ESTADO_PDF = {
  borrador: 'Borrador', en_revision: 'En revisión', vigente: 'Vigente', obsoleto: 'Obsoleto'
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) + ' hs'
}

// Replace encrypted hex strings in generated manual text with ***
function maskEncrypted(text) {
  if (!text) return text
  return text
    .replace(/[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+/gi, '***')
    .replace(/\n{2,}/g, '\n')
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
function ManualPDF({ funcion, manual, historial = [] }) {
  const {
    contenido = {}, generadoEn, version = 'Borrador', estado = 'borrador',
    aprobadoEn, aprobadoPorNombre, ocupanteNombre
  } = manual

  const bloques = Object.entries(BLOQUE_NOMBRES)
    .filter(([key]) => contenido[key])
    .map(([key, nombre]) => ({ key, nombre, texto: maskEncrypted(contenido[key]) }))

  const docControlParts = [
    version,
    ESTADO_PDF[estado] || estado,
    generadoEn ? `Generado: ${fmtDate(generadoEn)}` : null,
    aprobadoEn ? `Aprobado: ${fmtDate(aprobadoEn)}` : null,
    ocupanteNombre ? `Elaborado por: ${ocupanteNombre}` : null,
    aprobadoPorNombre ? `Aprobado por: ${aprobadoPorNombre}` : null,
  ].filter(Boolean).join(' · ')

  const PageFooter = () => (
    <View style={pdfStyles.footer} fixed>
      <Text>Registro de Experiencia y Memoria Institucional (REMI) · Don Emilio</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document>
      {/* ── Contenido principal ── */}
      <Page size="A4" style={pdfStyles.page}>
        {/* Control documental: encabezado compacto en una sola línea */}
        <View style={pdfStyles.docControlBar}>
          <Text style={pdfStyles.docControlText}>{docControlParts}</Text>
        </View>

        {/* Logo + título */}
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerRow}>
            <Image src={LOGO_URL} style={pdfStyles.logo} />
          </View>
          <Text style={pdfStyles.title}>Manual de Puesto: {funcion}</Text>
        </View>

        {/* B1: Identificación del puesto */}
        <View style={pdfStyles.bloque}>
          <Text style={pdfStyles.bloqueTitle}>Identificación del puesto</Text>
          <View style={pdfStyles.b1Box}>
            <View style={pdfStyles.b1Row}>
              <Text style={pdfStyles.b1Label}>Nombre del puesto:</Text>
              <Text style={pdfStyles.b1Value}>{funcion}</Text>
            </View>
            <View style={pdfStyles.b1Row}>
              <Text style={pdfStyles.b1Label}>Organización:</Text>
              <Text style={pdfStyles.b1Value}>Don Emilio</Text>
            </View>
            {ocupanteNombre && (
              <View style={pdfStyles.b1Row}>
                <Text style={pdfStyles.b1Label}>Ocupante:</Text>
                <Text style={pdfStyles.b1Value}>{ocupanteNombre}</Text>
              </View>
            )}
          </View>
        </View>

        {/* B2–B6 */}
        {bloques.map(({ key, nombre, texto }) => (
          <View key={key} style={pdfStyles.bloque}>
            <Text style={pdfStyles.bloqueTitle} wrap={false}>{nombre}</Text>
            <Text style={pdfStyles.bloqueText} wrap={true}>{texto}</Text>
          </View>
        ))}

        {/* Firma digital: solo en manuales vigentes */}
        {estado === 'vigente' && aprobadoEn && (
          <View style={pdfStyles.firmaBox}>
            <Text style={pdfStyles.firmaTitulo}>Registro de aprobación</Text>
            <View style={pdfStyles.b0Grid}>
              {aprobadoPorNombre && (
                <View style={pdfStyles.b0Cell}>
                  <Text style={pdfStyles.b0Label}>Aprobado por</Text>
                  <Text style={pdfStyles.b0Value}>{aprobadoPorNombre}</Text>
                </View>
              )}
              <View style={pdfStyles.b0Cell}>
                <Text style={pdfStyles.b0Label}>Fecha y hora (Buenos Aires)</Text>
                <Text style={pdfStyles.b0Value}>{fmtDateTime(aprobadoEn)}</Text>
              </View>
            </View>
            <Text style={pdfStyles.firmaNote}>
              Este registro es inmutable. Sistema: Registro de Experiencia y Memoria Institucional (REMI) · Don Emilio
            </Text>
          </View>
        )}

        <PageFooter />
      </Page>

      {/* ── Historial de versiones: última página aparte ── */}
      {historial.length > 0 && (
        <Page size="A4" style={pdfStyles.page}>
          <View style={pdfStyles.bloque}>
            <Text style={pdfStyles.bloqueTitle}>Historial de versiones</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.tableHeaderCell, { flex: 1 }]}>Versión</Text>
              <Text style={[pdfStyles.tableHeaderCell, { flex: 2.5 }]}>Fecha</Text>
              <Text style={[pdfStyles.tableHeaderCell, { flex: 1.5 }]}>Estado</Text>
            </View>
            {historial.map((h, i) => (
              <View key={h.id} style={[pdfStyles.tableRow, i % 2 !== 0 && pdfStyles.tableRowAlt]}>
                <Text style={[pdfStyles.tableCell, { flex: 1 }]}>{h.version}</Text>
                <Text style={[pdfStyles.tableCell, { flex: 2.5 }]}>{fmtDate(h.generadoEn || h.createdAt)}</Text>
                <Text style={[pdfStyles.tableCell, { flex: 1.5 }]}>{ESTADO_PDF[h.estado] || h.estado}</Text>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}
    </Document>
  )
}

// ─── Word diff ───────────────────────────────────────────────────────────────
function WordDiff({ oldText, newText }) {
  if (!oldText) return <p className="text-xs leading-relaxed whitespace-pre-wrap">{newText}</p>
  const parts = diffWords(oldText, newText)
  return (
    <p className="text-xs leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => (
        <span key={i} style={{
          background: part.added ? '#d4edda' : part.removed ? '#f8d7da' : 'transparent',
          color: part.added ? '#155724' : part.removed ? '#721c24' : 'inherit',
          textDecoration: part.removed ? 'line-through' : 'none',
        }}>{part.value}</span>
      ))}
    </p>
  )
}

// ─── Manual section ───────────────────────────────────────────────────────────
function ManualSection({ funcion, color, onManualEstado, isPrimary, autoRegenTrigger }) {
  const { user } = useAuth()
  const autoaprobarManual = !!user?.autoaprobarManual
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
  const [contenidoAnterior, setContenidoAnterior] = useState(null)
  const [showDiff, setShowDiff] = useState(true)

  useEffect(() => { loadManual() }, [funcion])
  useEffect(() => {
    onManualEstado?.(manual ? { estado: manual.estado, generadoEn: manual.generadoEn } : null)
  }, [manual])
  useEffect(() => {
    if (!autoRegenTrigger) return
    generarOActualizar()
  }, [autoRegenTrigger])

  async function loadManual() {
    setLoading(true)
    try {
      const [manualRes, histRes] = await Promise.all([
        api.get(`/manual/${encodeURIComponent(funcion)}`),
        api.get(`/manual/${encodeURIComponent(funcion)}/historial`)
      ])
      setManual(manualRes.data.data)
      setContenidoAnterior(manualRes.data.data?.contenidoAnterior || null)
      setHistorial(histRes.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function generarOActualizar() {
    setGenerating(true)
    try {
      await api.post(`/manual/${encodeURIComponent(funcion)}/generar`)
      // Recargar para traer la base del diff (contenidoAnterior) actualizada
      await loadManual()
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
        <ManualPDF funcion={funcion} manual={manual} historial={historial} />
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

  // Un bloque está "editado" si su contenido difiere de la última versión aprobada
  // (no se marca en manuales ya vigentes, donde no hay cambios pendientes que mostrar)
  function bloqueCambiado(key) {
    if (!contenidoAnterior || manual?.estado === 'vigente') return false
    return maskEncrypted(contenidoAnterior[key] || '') !== maskEncrypted(manual.contenido[key] || '')
  }

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
          {isPrimary === false && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">Solo lectura</span>
          )}
          {isPrimary !== false && manual?.estado !== 'en_revision' && (
            <Button data-tour="manual-generar" size="sm" onClick={generarOActualizar} disabled={generating} className="gap-1 text-xs h-7" style={{ background: color, color: 'white' }}>
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
              {isPrimary !== false && manual.estado === 'borrador' && (() => {
                const tieneDevueltos = manual.bloquesEstado &&
                  Object.values(manual.bloquesEstado).some(b => b.estado === 'devuelto')
                return tieneDevueltos ? (
                  <span className="text-xs text-orange-600 font-medium px-2 py-1 bg-orange-50 rounded-lg border border-orange-200">
                    Actualizá el manual antes de reenviar
                  </span>
                ) : (
                  <Button data-tour="manual-enviar" size="sm" variant="outline" onClick={() => setShowEnviarDialog(true)} className="gap-1 text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-50">
                    <Send size={12} />
                    {autoaprobarManual ? 'Publicar manual' : 'Enviar a aprobación'}
                  </Button>
                )
              })()}
              {manual.estado === 'en_revision' && (
                <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-lg">
                  En revisión
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

          {/* Estado por bloque durante revisión */}
          {manual.estado === 'en_revision' && manual.bloquesEstado && (
            <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-700 mb-2">Estado de revisión</p>
              <div className="flex flex-col gap-1">
                {Object.entries(BLOQUE_NOMBRES).filter(([k]) => manual.contenido?.[k]).map(([k, nombre]) => {
                  const bs = manual.bloquesEstado?.[k]
                  const est = bs?.estado || 'en_revision'
                  return (
                    <div key={k} className="flex items-start gap-2 text-xs">
                      {est === 'aprobado'
                        ? <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                        : est === 'devuelto'
                        ? <RotateCcw size={12} className="text-orange-500 mt-0.5 shrink-0" />
                        : <div className="w-3 h-3 rounded-full border-2 border-blue-300 mt-0.5 shrink-0" />}
                      <span style={{ color: est === 'aprobado' ? '#16a34a' : est === 'devuelto' ? '#ea580c' : '#6b7280' }}>
                        {nombre}
                        {bs?.observacion && (
                          <span className="block italic text-orange-700 mt-0.5">→ {bs.observacion}</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {contenidoAnterior && manual?.estado !== 'vigente' && (
            <div className="flex text-xs rounded-lg border overflow-hidden self-start mb-1" style={{ borderColor: '#d1d5db' }}>
              <button
                onClick={() => setShowDiff(true)}
                className="flex items-center gap-1 px-2.5 py-1 transition-colors"
                style={{ background: showDiff ? color : 'transparent', color: showDiff ? '#fff' : '#6b7280', fontWeight: showDiff ? 600 : 400 }}
              >
                <GitCompare size={11} /> Cambios
              </button>
              <button
                onClick={() => setShowDiff(false)}
                className="flex items-center gap-1 px-2.5 py-1 transition-colors border-l"
                style={{ borderColor: '#d1d5db', background: !showDiff ? color : 'transparent', color: !showDiff ? '#fff' : '#6b7280', fontWeight: !showDiff ? 600 : 400 }}
              >
                <FileText size={11} /> Texto
              </button>
            </div>
          )}

          <div data-tour="manual-bloques" className="flex flex-col gap-2">
            {bloques.map(([key, nombre]) => {
              const cambiado = bloqueCambiado(key)
              return (
              <div key={key} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left hover:bg-muted/50 transition-colors"
                  style={{ color: cambiado ? '#b45309' : color }}
                  onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}
                >
                  <span className="flex items-center gap-1.5">
                    {cambiado && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Bloque con cambios" />}
                    {nombre}
                  </span>
                  {expanded[key] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {expanded[key] && (
                  <div className="px-3 pb-3 pt-2 border-t bg-muted/20 text-muted-foreground">
                    {contenidoAnterior && showDiff && manual?.estado !== 'vigente'
                      ? <WordDiff oldText={maskEncrypted(contenidoAnterior[key] || null)} newText={maskEncrypted(manual.contenido[key])} />
                      : <p className="text-xs leading-relaxed whitespace-pre-wrap">{maskEncrypted(manual.contenido[key])}</p>
                    }
                  </div>
                )}
              </div>
              )
            })}
          </div>

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
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{autoaprobarManual ? 'Publicar manual' : 'Enviar manual a aprobación'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {autoaprobarManual
              ? <>Tu manual de <strong>{funcion}</strong> (v{manual?.version}) quedará vigente de inmediato. No tenés un revisor asignado, así que se publica directamente.</>
              : <>Tu manual de <strong>{funcion}</strong> (v{manual?.version}) será enviado a tu supervisor para revisión. No podrás editarlo hasta recibir respuesta.</>}
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">{autoaprobarManual ? 'Nota (opcional)' : 'Nota para el revisor (opcional)'}</label>
            <Textarea placeholder="Agregá contexto o comentarios relevantes..." value={notaEnvio} onChange={e => setNotaEnvio(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEnviarDialog(false); setNotaEnvio('') }}>Cancelar</Button>
            <Button onClick={enviarAAprobacion} disabled={sending} className="gap-1" style={{ background: color, color: 'white' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {autoaprobarManual ? 'Publicar' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Entries section ──────────────────────────────────────────────────────────
const EDITED_KEY = 'remi_edited_entries'
function loadEditedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(EDITED_KEY) || '[]')) } catch { return new Set() }
}
function persistEditedIds(ids) {
  try { localStorage.setItem(EDITED_KEY, JSON.stringify([...ids])) } catch {}
}

// Valor previo a la edición de cada respuesta, para poder descartar y volver al original
const ORIGINAL_KEY = 'remi_edited_original'
function loadOriginals() {
  try { return JSON.parse(localStorage.getItem(ORIGINAL_KEY) || '{}') } catch { return {} }
}
function persistOriginals(map) {
  try { localStorage.setItem(ORIGINAL_KEY, JSON.stringify(map)) } catch {}
}

function EntradasSection({ funcion, color, refreshTrigger, manualEstado, generadoEn, isPrimary, clearEditedTrigger, onDiscardIncorporado }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editedIds, setEditedIds] = useState(loadEditedIds)
  const [autoSensibleIds, setAutoSensibleIds] = useState(new Set())

  useEffect(() => { loadEntries() }, [funcion, refreshTrigger])

  useEffect(() => {
    if (!clearEditedTrigger) return
    persistEditedIds(new Set())
    persistOriginals({})
    setEditedIds(new Set())
    loadEntries()
  }, [clearEditedTrigger])

  async function loadEntries() {
    setLoading(true)
    try {
      const res = await api.get('/knowledge', { params: { funcion, categoria: 'checkin' } })
      const all = res.data.data || []
      const stored = loadEditedIds()
      // Move previously edited entries to the top, preserving their relative order
      const edited = all.filter(e => stored.has(e.id))
      const rest = all.filter(e => !stored.has(e.id))
      setEntries([...edited, ...rest])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function discardEdit(id) {
    // Si la respuesta ya estaba incorporada al borrador (verde), el borrador quedará
    // desactualizado tras la reversión → notificar para regenerar automáticamente.
    const entry = entries.find(e => e.id === id)
    const wasIncorporado = entry && generadoEn &&
      new Date(entry.updatedAt) <= new Date(generadoEn)

    const originals = loadOriginals()
    if (id in originals) {
      try { await api.put(`/knowledge/${id}`, { contenido: originals[id] }) } catch { /* ignore */ }
      delete originals[id]
      persistOriginals(originals)
    }
    setEditedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      persistEditedIds(next)
      return next
    })
    loadEntries()
    if (wasIncorporado) onDiscardIncorporado?.()
  }

  async function saveEdit(id) {
    setSaving(true)
    try {
      // Guardar el valor original (la primera vez que se edita en este ciclo) para poder descartar
      const prevEntry = entries.find(e => e.id === id)
      const originals = loadOriginals()
      if (prevEntry && !(id in originals)) {
        originals[id] = prevEntry.contenido
        persistOriginals(originals)
      }
      const res = await api.put(`/knowledge/${id}`, { contenido: editContent })
      const updated = res.data.data
      setEntries(prev => [updated, ...prev.filter(e => e.id !== id)])
      setEditingId(null)
      setEditedIds(prev => {
        const next = new Set([...prev, id])
        persistEditedIds(next)
        return next
      })
      if (res.data.sensibleAutoDetectado) setAutoSensibleIds(prev => new Set([...prev, id]))
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  if (!loading && entries.length === 0) return null

  return (
    <div className="mt-5 pt-4 border-t" data-tour="manual-entradas">
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
          {entries.map(entry => {
            const isEdited = editedIds.has(entry.id)
            // Verde = el cambio ya quedó incorporado al borrador (editado antes de la última generación)
            // Ámbar = editado pero pendiente de actualizar el borrador
            const incorporado = isEdited && generadoEn &&
              new Date(entry.updatedAt) <= new Date(generadoEn)
            const isAutoSensible = autoSensibleIds.has(entry.id) && manualEstado === 'borrador'
            const isBlocked = entry._bloqueado === true
            return (
              <div
                key={entry.id}
                className={`rounded-lg p-3 ${
                  incorporado ? 'ring-2 ring-green-300 bg-green-50'
                  : isEdited ? 'ring-2 ring-amber-300 bg-amber-50'
                  : 'bg-[#f9faf9]'
                }`}
              >
                <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color }}>
                  {entry.titulo}
                  {entry.esSensible && !isBlocked && (
                    <span className="text-xs font-normal text-amber-600 ml-1">🔒</span>
                  )}
                </p>
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
                      {isBlocked
                        ? <span className="text-muted-foreground italic">🔒 Información sensible restringida</span>
                        : entry.contenido}
                    </p>
                    {!isBlocked && isPrimary !== false && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isEdited && (
                          <button
                            onClick={() => discardEdit(entry.id)}
                            title="Descartar cambio y volver al valor original"
                            className={`p-1 transition-colors ${incorporado ? 'text-green-500 hover:text-green-700' : 'text-amber-400 hover:text-amber-600'}`}
                          >
                            <X size={13} />
                          </button>
                        )}
                        <button onClick={() => { setEditingId(entry.id); setEditContent(entry.contenido) }} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isAutoSensible && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Marcada automáticamente como sensible
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Mi Manual page ───────────────────────────────────────────────────────────
export default function MiManual() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const funciones = user?.funciones || []
  const [selectedFn, setSelectedFn] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [todaySessions, setTodaySessions] = useState([])
  const [onboardingStatus, setOnboardingStatus] = useState({})
  const [dailyCounts, setDailyCounts] = useState({})
  const [entryCounts, setEntryCounts] = useState({})
  const [refreshEntries, setRefreshEntries] = useState(0)
  const [manualMeta, setManualMeta] = useState({})
  const [clearEditedTrigger, setClearEditedTrigger] = useState(0)
  const [autoRegenTrigger, setAutoRegenTrigger] = useState(0)
  const [primaryStatusMap, setPrimaryStatusMap] = useState({})

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
      setPrimaryStatusMap(res.data.primaryStatusMap || {})
    } catch { /* ignore */ }
    finally { setInitializing(false) }
  }

  function sessionForFuncion(fn) {
    return todaySessions.find(s => s.funcion === fn) || null
  }

  // El check-in se responde únicamente desde Inicio; acá solo se refleja si hay pendiente.
  // Si el usuario está de vacaciones, no se muestra nada.
  function checkinPendiente(fn) {
    if (user?.enVacaciones) return false
    if (primaryStatusMap[fn] === false) return false
    if ((dailyCounts[fn] || 0) >= 20) return false
    return !sessionForFuncion(fn)?.completado
  }

  // Los bloques del manual y las respuestas anteriores viven en secciones hijas que
  // hacen su propio fetch tras montar, así que les damos más margen que al Dashboard
  // antes de medir qué elementos ya están pintados.
  const autoaprobarManualUser = !!user?.autoaprobarManual
  const { replay: verTour } = useTour({
    tourId: 'manual',
    userId: user?.id,
    listo: !initializing && !!user,
    delayMs: 700,
    steps: [
      {
        popover: {
          title: 'Mi Manual',
          description: 'Con tus respuestas del check-in se arma solo el manual de tu puesto. Te muestro cómo generarlo, editarlo y enviarlo a aprobación.'
        }
      },
      {
        element: '[data-tour="manual-tabs"]',
        popover: {
          title: 'Tus funciones',
          description: 'Si tenés más de una función asignada, cambiás acá entre los manuales de cada una. Cada una tiene su propio progreso y su propio manual.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="manual-generar"]',
        popover: {
          title: 'Generar o actualizar',
          description: '"Generar manual" arma el borrador la primera vez. Después, cada vez que respondas preguntas nuevas en el check-in vas a ver "Actualizar": solo reescribe los bloques que tienen respuestas nuevas o editadas, el resto queda intacto.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="manual-bloques"]',
        popover: {
          title: 'Bloques del manual',
          description: 'El contenido está organizado en bloques (funciones, procesos, herramientas, etc). Click en cada uno para expandirlo. El punto naranja junto al título marca los bloques con cambios todavía no enviados, y podés alternar entre ver "Cambios" (resaltados) o el "Texto" final.',
          side: 'top'
        }
      },
      {
        element: '[data-tour="manual-enviar"]',
        popover: {
          title: autoaprobarManualUser ? 'Publicar manual' : 'Enviar a aprobación',
          description: autoaprobarManualUser
            ? 'No tenés un revisor asignado, así que acá lo publicás vos mismo: al confirmar, el manual queda "Vigente" de inmediato, sin pasar por revisión.'
            : 'Cuando esté listo, hacé click acá: podés agregar una nota opcional para tu supervisor y confirmar el envío. Mientras diga "En revisión" no vas a poder editarlo. Si te lo devuelve, vas a ver sus observaciones arriba de los bloques y vas a poder corregir y reenviar.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="manual-entradas"]',
        popover: {
          title: 'Respuestas anteriores',
          description: 'Acá está cada respuesta que diste en el check-in. Click en el lápiz para editarla, escribí el cambio y tocá "Guardar". Las respuestas editadas quedan resaltadas: en ámbar mientras el manual todavía no las incorporó, y en verde una vez que las incorporaste con "Actualizar". Podés descartar un cambio con la X para volver a la respuesta original.',
          side: 'top'
        }
      }
    ]
  })

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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Mi Manual</h1>
          <p className="text-sm text-muted-foreground">Acá encontrarás la documentación de tu puesto y lo que tengas pendiente de completar.</p>
        </div>
        <button
          onClick={verTour}
          title="Ver cómo funciona"
          className="flex items-center justify-center shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <HelpCircle size={14} />
        </button>
      </div>

      {/* Function tabs */}
      {funciones.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5" data-tour="manual-tabs">
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
          {/* 1: Aviso: el check-in se responde desde Inicio */}
          {checkinPendiente(selectedFn) && (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 mb-5 px-4 py-3 rounded-xl text-left cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: '#fff8e1', border: '1px solid #f0d060' }}
            >
              <CalendarCheck className="text-amber-600 shrink-0" size={18} />
              <div className="flex-1">
                <p className="font-semibold text-xs text-amber-900">
                  {onboardingStatus[selectedFn]
                    ? 'Tenés el check-in diario pendiente'
                    : 'Tenés las preguntas iniciales pendientes'}
                </p>
                <p className="text-xs text-amber-700">Respondelo desde Inicio para seguir documentando tu función.</p>
              </div>
              <ArrowRight size={15} className="text-amber-600 shrink-0" />
            </button>
          )}

          {/* 2: Manual */}
          <ManualSection
            funcion={selectedFn}
            color={color}
            onManualEstado={meta => {
              setManualMeta(prev => ({ ...prev, [selectedFn]: meta }))
              if (meta?.estado === 'vigente') setClearEditedTrigger(n => n + 1)
            }}
            isPrimary={primaryStatusMap[selectedFn] ?? true}
            autoRegenTrigger={autoRegenTrigger}
          />

          {/* 3: Previous answers */}
          {(onboardingStatus[selectedFn] || primaryStatusMap[selectedFn] === false) && (
            <EntradasSection
              funcion={selectedFn}
              color={color}
              refreshTrigger={refreshEntries}
              manualEstado={manualMeta[selectedFn]?.estado}
              generadoEn={manualMeta[selectedFn]?.generadoEn}
              isPrimary={primaryStatusMap[selectedFn] ?? true}
              clearEditedTrigger={clearEditedTrigger}
              onDiscardIncorporado={() => setAutoRegenTrigger(n => n + 1)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
