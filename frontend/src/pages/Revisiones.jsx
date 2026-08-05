import { useState, useEffect, useCallback } from 'react'
import { diffWords } from 'diff'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTour } from '@/lib/tour'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, RotateCcw, ClipboardCheck, GitCompare, FileText, X, HelpCircle } from 'lucide-react'

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
}

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

function BloqueReview({ bloqueKey, nombre, contenido, contenidoAnterior, bloqueEstado, color, showDiff, onAprobar, onDevolver }) {
  const [expanded, setExpanded] = useState(false)
  const [showObsInput, setShowObsInput] = useState(false)
  const [obs, setObs] = useState('')
  const [loadingA, setLoadingA] = useState(false)
  const [loadingD, setLoadingD] = useState(false)

  const estado = bloqueEstado?.estado || 'en_revision'
  const observacion = bloqueEstado?.observacion

  const borderColor = estado === 'aprobado' ? '#bbf7d0' : estado === 'devuelto' ? '#fed7aa' : '#e5e7eb'
  const estadoLabel = estado === 'aprobado'
    ? <span className="text-xs font-medium text-green-600 flex items-center gap-1"><CheckCircle2 size={11} />Aprobado</span>
    : estado === 'devuelto'
    ? <span className="text-xs font-medium text-orange-500 flex items-center gap-1"><RotateCcw size={11} />Devuelto</span>
    : null

  async function handleAprobar() {
    setLoadingA(true)
    try { await onAprobar(bloqueKey) } finally { setLoadingA(false) }
  }

  async function handleDevolver() {
    if (!obs.trim()) return
    setLoadingD(true)
    try {
      await onDevolver(bloqueKey, obs)
      setShowObsInput(false)
      setObs('')
    } finally { setLoadingD(false) }
  }

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-muted/40 transition-colors"
        style={{ color }}
        onClick={() => setExpanded(e => !e)}
      >
        <span>{nombre}</span>
        <span className="flex items-center gap-2">
          {estadoLabel}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t bg-muted/10">
          <div className="px-3 py-2 text-muted-foreground">
            {contenidoAnterior && showDiff
              ? <WordDiff oldText={contenidoAnterior} newText={contenido} />
              : <p className="text-xs leading-relaxed whitespace-pre-wrap">{contenido}</p>
            }
          </div>

          {observacion && (
            <div className="mx-3 mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
              <span className="font-medium">Observación: </span>{observacion}
            </div>
          )}

          {estado !== 'aprobado' && (
            <div className="px-3 pb-3">
              {!showObsInput ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAprobar} disabled={loadingA}
                    className="gap-1 text-xs h-7 bg-green-600 hover:bg-green-700 text-white">
                    {loadingA ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Aprobar bloque
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowObsInput(true)}
                    className="gap-1 text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50">
                    <RotateCcw size={11} /> Devolver
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && (setShowObsInput(false), setObs(''))}
                    placeholder="Observación para este bloque..."
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-orange-300"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleDevolver} disabled={loadingD || !obs.trim()}
                      className="gap-1 text-xs h-7 bg-orange-600 hover:bg-orange-700 text-white">
                      {loadingD ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      Devolver bloque
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowObsInput(false); setObs('') }}
                      className="text-xs h-7 text-muted-foreground">
                      <X size={11} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ManualCard({ manual: initialManual, onResolved, isFirst }) {
  const [manual, setManual] = useState(initialManual)
  const [showDiff, setShowDiff] = useState(true)
  const [showDevolverTodo, setShowDevolverTodo] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [approvingAll, setApprovingAll] = useState(false)
  const [returningAll, setReturningAll] = useState(false)

  const color = FUNC_COLORS[manual.funcion] || '#1a3a1a'
  const bloques = Object.entries(BLOQUE_NOMBRES).filter(([k]) => manual.contenido?.[k])
  const hasPrevious = !!manual.contenidoAnterior
  const bloquesEstado = manual.bloquesEstado || {}

  // Solo mostrar bloques que requieren revisión (en_revision o devuelto); los no modificados ya llegaron aprobados
  const bloquesRevisar = bloques.filter(([k]) => bloquesEstado[k]?.estado !== 'aprobado' || !hasPrevious)
  const autoAprobados = bloques.length - bloquesRevisar.length

  const aprobados = bloques.filter(([k]) => bloquesEstado[k]?.estado === 'aprobado').length
  const devueltos = bloques.filter(([k]) => bloquesEstado[k]?.estado === 'devuelto').length
  const pendientes = bloques.length - aprobados - devueltos

  async function aprobarBloque(bloque) {
    const res = await api.post(`/manual/${manual.id}/aprobar-bloque`, { bloque })
    const updated = res.data.data
    if (updated.allAprobados) {
      onResolved(manual.id)
    } else {
      setManual(prev => ({ ...prev, bloquesEstado: updated.bloquesEstado }))
    }
  }

  async function devolverBloque(bloque, observacion) {
    const res = await api.post(`/manual/${manual.id}/devolver-bloque`, { bloque, observacion })
    const updated = res.data.data
    if (updated.allResolved) {
      onResolved(manual.id)
    } else {
      setManual(prev => ({ ...prev, bloquesEstado: updated.bloquesEstado }))
    }
  }

  async function aprobarTodo() {
    setApprovingAll(true)
    try {
      await api.post(`/manual/${manual.id}/aprobar`)
      onResolved(manual.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al aprobar')
    } finally { setApprovingAll(false) }
  }

  async function devolverTodo() {
    if (!observaciones.trim()) return
    setReturningAll(true)
    try {
      await api.post(`/manual/${manual.id}/devolver`, { observaciones })
      setShowDevolverTodo(false)
      setObservaciones('')
      onResolved(manual.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al devolver')
    } finally { setReturningAll(false) }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4" style={{ background: color }}>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {FUNC_ICONS[manual.funcion]} {manual.funcion}
          <span className="ml-1 text-xs font-normal opacity-80">v{manual.version}</span>
          <span className="ml-auto text-xs font-normal opacity-80">{manual.ocupante?.nombre}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Metadata row */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Enviado: {new Date(manual.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
              {bloquesRevisar.length === 0
                ? 'Todos los bloques aprobados'
                : `${bloquesRevisar.length - pendientes}/${bloquesRevisar.length} revisados`}
              {devueltos > 0 && <span className="text-orange-600"> · {devueltos} devueltos</span>}
            </span>
          </div>
          <div className="flex items-center gap-2" data-tour={isFirst ? 'revisiones-acciones' : undefined}>
            {hasPrevious && (
              <div className="flex text-xs rounded-lg border overflow-hidden" style={{ borderColor: '#d1d5db' }}>
                <button onClick={() => setShowDiff(true)}
                  className="flex items-center gap-1 px-2.5 py-1 transition-colors"
                  style={{ background: showDiff ? color : 'transparent', color: showDiff ? '#fff' : '#6b7280', fontWeight: showDiff ? 600 : 400 }}>
                  <GitCompare size={11} /> Cambios
                </button>
                <button onClick={() => setShowDiff(false)}
                  className="flex items-center gap-1 px-2.5 py-1 transition-colors border-l"
                  style={{ borderColor: '#d1d5db', background: !showDiff ? color : 'transparent', color: !showDiff ? '#fff' : '#6b7280', fontWeight: !showDiff ? 600 : 400 }}>
                  <FileText size={11} /> Texto
                </button>
              </div>
            )}
            <Button size="sm" onClick={aprobarTodo} disabled={approvingAll}
              className="gap-1 text-xs h-7 bg-green-600 hover:bg-green-700 text-white">
              {approvingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Aprobar todo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDevolverTodo(true)}
              className="gap-1 text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50">
              <RotateCcw size={12} /> Devolver
            </Button>
          </div>
        </div>

        {/* Nota del ocupante */}
        {manual.notaEnvio && (
          <div className="mb-3 bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Nota del ocupante:</p>
            <p className="text-xs italic">"{manual.notaEnvio}"</p>
          </div>
        )}

        {/* Bloques con revisión individual: solo los modificados */}
        {autoAprobados > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CheckCircle2 size={11} className="text-green-500" />
            {autoAprobados} bloque{autoAprobados > 1 ? 's' : ''} sin cambios, aprobado{autoAprobados > 1 ? 's' : ''} automáticamente
          </p>
        )}
        <div className="flex flex-col gap-1.5" data-tour={isFirst && bloquesRevisar.length > 0 ? 'revisiones-bloque' : undefined}>
          {bloquesRevisar.map(([key, nombre]) => (
            <BloqueReview
              key={key}
              bloqueKey={key}
              nombre={nombre}
              contenido={manual.contenido[key]}
              contenidoAnterior={manual.contenidoAnterior?.[key] || null}
              bloqueEstado={bloquesEstado[key]}
              color={color}
              showDiff={showDiff}
              onAprobar={aprobarBloque}
              onDevolver={devolverBloque}
            />
          ))}
        </div>
      </CardContent>

      {/* Devolver todo dialog */}
      <Dialog open={showDevolverTodo} onOpenChange={setShowDevolverTodo}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Devolver manual con observaciones</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            El manual volverá a borrador. El ocupante recibirá tus observaciones y podrá corregir antes de reenviar.
          </p>
          <Textarea placeholder="Describí qué debe corregir o mejorar..."
            value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={4} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDevolverTodo(false); setObservaciones('') }}>Cancelar</Button>
            <Button onClick={devolverTodo} disabled={returningAll || !observaciones.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1">
              {returningAll ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function Revisiones() {
  const [manuales, setManuales] = useState([])
  const [loading, setLoading] = useState(true)
  const { refresh: refreshNotifications } = useNotifications()
  const { user } = useAuth()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/manual/pendientes')
      setManuales(res.data.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function removeManual(id) {
    setManuales(prev => prev.filter(m => m.id !== id))
    refreshNotifications()
  }

  const { replay: verTour } = useTour({
    tourId: 'revisiones',
    userId: user?.id,
    listo: !loading && !!user,
    steps: [
      {
        popover: {
          title: 'Revisiones',
          description: 'Acá llegan los manuales que tus supervisados envían a aprobación. Cuando uno se envía, queda "En revisión" y esa persona no puede editarlo hasta que vos respondas. Si ahora mismo no hay ninguno pendiente, es porque están todos al día. Esta pantalla se actualiza sola apenas alguien te envíe uno.'
        }
      },
      {
        element: '[data-tour="revisiones-acciones"]',
        popover: {
          title: 'Aprobar o devolver todo',
          description: '"Aprobar todo" deja el manual como "Vigente" de inmediato. "Devolver" abre un cuadro para escribir una observación general: el manual vuelve a "Borrador", el ocupante la ve en su pantalla, corrige y te lo vuelve a enviar. El botón "Cambios" te muestra qué se modificó respecto a la versión anterior aprobada, resaltado en rojo/verde.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-tour="revisiones-bloque"]',
        popover: {
          title: 'Revisión por bloque',
          description: 'Si solo una parte necesita ajustes, no hace falta devolver todo el manual: expandí el bloque y aprobalo o devolvelo con su propia observación puntual. Los bloques que no cambiaron respecto a la versión anterior ya vienen aprobados automáticamente y no aparecen acá. Cuando quedan todos los bloques resueltos (aprobados o devueltos), el manual se resuelve solo y desaparece de esta lista.',
          side: 'top'
        }
      }
    ]
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1a3a1a' }}>
            <ClipboardCheck size={20} />
            Revisiones
          </h1>
          <p className="text-sm text-muted-foreground">Manuales pendientes de tu aprobación</p>
        </div>
        <button
          onClick={verTour}
          title="Ver cómo funciona"
          className="flex items-center justify-center shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <HelpCircle size={14} />
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : manuales.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium">Todo al día</p>
            <p className="text-xs text-muted-foreground mt-1">No hay manuales pendientes de revisión.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">{manuales.length} manual{manuales.length > 1 ? 'es' : ''} pendiente{manuales.length > 1 ? 's' : ''}</p>
          {manuales.map((m, i) => (
            <ManualCard key={m.id} manual={m} onResolved={removeManual} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
