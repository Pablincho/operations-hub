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
import { Loader2, Download, Send, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

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
      {/* Header */}
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
          <DialogHeader>
            <DialogTitle>Enviar manual a aprobación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tu manual de <strong>{funcion}</strong> (v{manual?.version}) será enviado a tu supervisor para revisión. No podrás editarlo hasta recibir respuesta.
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">Nota para el revisor (opcional)</label>
            <Textarea
              placeholder="Agregá contexto o comentarios relevantes..."
              value={notaEnvio}
              onChange={e => setNotaEnvio(e.target.value)}
              rows={3}
            />
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

export default function Manual() {
  const { user } = useAuth()
  const funciones = user?.funciones || []
  const [selectedFn, setSelectedFn] = useState(funciones[0] || '')

  useEffect(() => {
    if (!selectedFn && funciones.length > 0) setSelectedFn(funciones[0])
  }, [funciones])

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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Mi Manual</h1>
        <p className="text-sm text-muted-foreground">Manual de puesto generado a partir de tus check-ins</p>
      </div>

      {funciones.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {funciones.map(fn => (
            <button
              key={fn}
              onClick={() => setSelectedFn(fn)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
              style={selectedFn === fn
                ? { background: FUNC_COLORS[fn], color: 'white', borderColor: FUNC_COLORS[fn] }
                : { background: 'transparent', color: '#666', borderColor: '#ddd' }
              }
            >
              {FUNC_ICONS[fn]} {fn}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <ManualSection funcion={selectedFn} color={color} />
        </CardContent>
      </Card>
    </div>
  )
}
