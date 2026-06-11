import { useState, useEffect } from 'react'
import { diffWords } from 'diff'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, RotateCcw, ClipboardCheck, GitCompare, FileText } from 'lucide-react'

const BLOQUE_NOMBRES = {
  B2: 'Funciones y responsabilidades',
  B3: 'Perfil del puesto',
  B4: 'Procesos y procedimientos',
  B5: 'Relaciones e interfaces',
  B6: 'Herramientas y sistemas'
}

function WordDiff({ oldText, newText }) {
  if (!oldText) {
    return <p className="text-xs leading-relaxed whitespace-pre-wrap">{newText}</p>
  }
  const parts = diffWords(oldText, newText)
  return (
    <p className="text-xs leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => (
        <span
          key={i}
          style={{
            background: part.added ? '#d4edda' : part.removed ? '#f8d7da' : 'transparent',
            color: part.added ? '#155724' : part.removed ? '#721c24' : 'inherit',
            textDecoration: part.removed ? 'line-through' : 'none',
          }}
        >
          {part.value}
        </span>
      ))}
    </p>
  )
}

function ManualCard({ manual, onApproved, onReturned }) {
  const [expanded, setExpanded] = useState({})
  const [showDiff, setShowDiff] = useState(true)
  const [showDevolver, setShowDevolver] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [approving, setApproving] = useState(false)
  const [returning, setReturning] = useState(false)

  const color = FUNC_COLORS[manual.funcion] || '#1a3a1a'
  const bloques = Object.entries(BLOQUE_NOMBRES).filter(([k]) => manual.contenido?.[k])
  const hasPrevious = !!manual.contenidoAnterior

  async function aprobar() {
    setApproving(true)
    try {
      await api.post(`/manual/${manual.id}/aprobar`)
      onApproved(manual.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al aprobar')
    } finally { setApproving(false) }
  }

  async function devolver() {
    if (!observaciones.trim()) return
    setReturning(true)
    try {
      await api.post(`/manual/${manual.id}/devolver`, { observaciones })
      setShowDevolver(false)
      setObservaciones('')
      onReturned(manual.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al devolver')
    } finally { setReturning(false) }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4" style={{ background: color }}>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {FUNC_ICONS[manual.funcion]} {manual.funcion}
          <span className="ml-1 text-xs font-normal opacity-80">v{manual.version}</span>
          <span className="ml-auto text-xs font-normal opacity-80">
            {manual.ocupante?.nombre}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Metadata */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            Enviado: {new Date(manual.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="flex gap-2">
            {hasPrevious && (
              <div className="flex text-xs rounded-lg border overflow-hidden" style={{ borderColor: '#d1d5db' }}>
                <button
                  onClick={() => setShowDiff(true)}
                  className="flex items-center gap-1 px-2.5 py-1 transition-colors"
                  style={{
                    background: showDiff ? color : 'transparent',
                    color: showDiff ? '#fff' : '#6b7280',
                    fontWeight: showDiff ? 600 : 400
                  }}
                >
                  <GitCompare size={11} /> Cambios
                </button>
                <button
                  onClick={() => setShowDiff(false)}
                  className="flex items-center gap-1 px-2.5 py-1 transition-colors border-l"
                  style={{
                    borderColor: '#d1d5db',
                    background: !showDiff ? color : 'transparent',
                    color: !showDiff ? '#fff' : '#6b7280',
                    fontWeight: !showDiff ? 600 : 400
                  }}
                >
                  <FileText size={11} /> Texto
                </button>
              </div>
            )}
            <Button
              size="sm"
              onClick={aprobar}
              disabled={approving}
              className="gap-1 text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
            >
              {approving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDevolver(true)}
              className="gap-1 text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <RotateCcw size={12} />
              Devolver
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

        {/* Bloques del manual */}
        <div className="flex flex-col gap-1.5">
          {bloques.map(([key, nombre]) => (
            <div key={key} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-muted/40 transition-colors"
                style={{ color }}
                onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}
              >
                {nombre}
                {expanded[key] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {expanded[key] && (
                <div className="px-3 pb-3 pt-1 border-t bg-muted/10 text-muted-foreground">
                  {hasPrevious && showDiff
                    ? <WordDiff oldText={manual.contenidoAnterior?.[key] || null} newText={manual.contenido[key]} />
                    : <p className="text-xs leading-relaxed whitespace-pre-wrap">{manual.contenido[key]}</p>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Devolver dialog */}
      <Dialog open={showDevolver} onOpenChange={setShowDevolver}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver manual con observaciones</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El ocupante recibirá tus observaciones y podrá corregir antes de reenviar.
          </p>
          <Textarea
            placeholder="Describí qué debe corregir o mejorar..."
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDevolver(false); setObservaciones('') }}>Cancelar</Button>
            <Button
              onClick={devolver}
              disabled={returning || !observaciones.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
            >
              {returning ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
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
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1a3a1a' }}>
          <ClipboardCheck size={20} />
          Revisiones
        </h1>
        <p className="text-sm text-muted-foreground">
          Manuales pendientes de tu aprobación
        </p>
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
          {manuales.map(m => (
            <ManualCard
              key={m.id}
              manual={m}
              onApproved={removeManual}
              onReturned={removeManual}
            />
          ))}
        </div>
      )}
    </div>
  )
}
