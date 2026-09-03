import { useEffect, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronUp, CirclePause, CirclePlay, Loader2, Plus, Save, Search, Settings2, SquareCheckBig } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATE_LABELS = {
  configuracion: 'Configuración', planificando: 'Agentes trabajando', relevamiento: 'Relevamiento activo',
  listo_para_generar: 'Listo para generar', generando: 'Generando y verificando', borrador: 'Borrador generado',
  en_revision: 'Manual en revisión', completado: 'Ciclo completado', pausado: 'Pausado'
}

function CycleCard({ position, topics, onRefresh }) {
  const cycle = position.ciclo
  const [expanded, setExpanded] = useState(cycle && cycle.estado !== 'completado')
  const [form, setForm] = useState(() => ({
    temas: cycle?.temas || [], orientacion: cycle?.orientacion || '', heredarOrientacion: cycle?.heredarOrientacion ?? true,
    preguntasPorEntrega: cycle?.preguntasPorEntrega || 3, frecuencia: cycle?.frecuencia || 'diaria',
    intervaloDias: cycle?.intervaloDias || 1, objetivoPreguntas: cycle?.objetivoPreguntas || '',
    requiereAprobacionPreguntas: cycle?.requiereAprobacionPreguntas ?? false
  }))
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cycle?.id) return
    api.get(`/manual-cycles/${cycle.id}/preguntas`).then(res => {
      const rows = res.data.data || []
      setQuestions(rows)
      setSelected(new Set(rows.filter(q => q.estado === 'propuesta').map(q => q.id)))
    }).catch(() => {})
  }, [cycle?.id])

  function toggleTopic(topic) {
    setForm(prev => ({ ...prev, temas: prev.temas.includes(topic) ? prev.temas.filter(item => item !== topic) : [...prev.temas, topic] }))
  }

  async function run(action, callback) {
    setBusy(action); setError('')
    try { await callback(); await onRefresh() }
    catch (err) { setError(err.response?.data?.error || 'No se pudo completar la acción') }
    finally { setBusy('') }
  }

  async function createCycle() {
    await run('crear', () => api.post('/manual-cycles', { funcion: position.funcion }))
    setExpanded(true)
  }
  async function save() { await run('guardar', () => api.patch(`/manual-cycles/${cycle.id}`, form)) }
  async function plan() {
    await run('planificar', async () => {
      await api.patch(`/manual-cycles/${cycle.id}`, form)
      await api.post(`/manual-cycles/${cycle.id}/planificar`)
    })
  }
  async function approveSelected() {
    await run('aprobar', async () => {
      const selectedQuestions = questions.filter(question => selected.has(question.id) && question.estado === 'propuesta')
      await Promise.all(selectedQuestions.map(question => api.patch(`/manual-cycles/${cycle.id}/preguntas/${question.id}`, { texto: question.texto })))
      await api.post(`/manual-cycles/${cycle.id}/aprobar-preguntas`, { ids: [...selected], rechazarResto: true })
    })
  }
  async function updateQuestion(question) {
    setBusy(question.id); setError('')
    try {
      const res = await api.patch(`/manual-cycles/${cycle.id}/preguntas/${question.id}`, { texto: question.texto })
      setQuestions(prev => prev.map(item => item.id === question.id ? res.data.data : item))
    } catch (err) { setError(err.response?.data?.error || 'No se pudo actualizar la pregunta') }
    finally { setBusy('') }
  }

  if (!cycle || cycle.estado === 'completado') {
    return (
      <Card><CardContent className="p-4 flex items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">{position.funcion}</p><p className="text-xs text-muted-foreground">{position.ocupante.nombre} · {cycle ? `ciclo ${cycle.numero} completado` : 'sin ciclos'}</p></div>
        <Button size="sm" onClick={createCycle} disabled={busy === 'crear'} className="gap-1.5">
          {busy === 'crear' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Iniciar {cycle ? 'siguiente ciclo' : 'primer ciclo'}
        </Button>
      </CardContent></Card>
    )
  }

  const proposed = questions.filter(question => question.estado === 'propuesta')
  const editable = ['configuracion', 'relevamiento', 'pausado'].includes(cycle.estado)
  const canPlan = ['configuracion', 'relevamiento'].includes(cycle.estado)

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded(value => !value)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="flex-1"><p className="text-sm font-semibold">{position.funcion} · ciclo {cycle.numero}</p><p className="text-xs text-muted-foreground">{position.ocupante.nombre} · {STATE_LABELS[cycle.estado] || cycle.estado} · {cycle.respuestasCiclo || 0} respuestas</p></div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && <CardContent className="px-4 pb-4 pt-0 border-t">
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-3"><Settings2 size={15} /><p className="text-sm font-semibold">Orientación de las próximas preguntas</p></div>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {topics.map(topic => <label key={topic} className="flex items-start gap-2 text-xs rounded-lg border p-2.5 cursor-pointer">
              <input type="checkbox" checked={form.temas.includes(topic)} disabled={!editable} onChange={() => toggleTopic(topic)} className="mt-0.5" />{topic}
            </label>)}
          </div>
          <Textarea value={form.orientacion} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, orientacion: event.target.value }))} placeholder="Escribí cualquier criterio, situación o aspecto particular que quieras investigar..." rows={3} />
          <div className="grid sm:grid-cols-4 gap-3 mt-3">
            <label className="text-xs">Preguntas por entrega<Input type="number" min="1" max="10" value={form.preguntasPorEntrega} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, preguntasPorEntrega: event.target.value }))} className="mt-1" /></label>
            <label className="text-xs">Frecuencia<select value={form.frecuencia} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, frecuencia: event.target.value }))} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="manual">Sin espera mínima</option></select></label>
            <label className="text-xs">Cada cuántos períodos<Input type="number" min="1" max="30" value={form.intervaloDias} disabled={!editable || form.frecuencia === 'manual'} onChange={event => setForm(prev => ({ ...prev, intervaloDias: event.target.value }))} className="mt-1" /></label>
            <label className="text-xs">Meta orientativa<Input type="number" min="1" placeholder="Sin meta" value={form.objetivoPreguntas} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, objetivoPreguntas: event.target.value }))} className="mt-1" /></label>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.requiereAprobacionPreguntas} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, requiereAprobacionPreguntas: event.target.checked }))} />Revisar cada tanda antes de enviarla</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.heredarOrientacion} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, heredarOrientacion: event.target.checked }))} />Heredar esta orientación al próximo ciclo</label>
          </div>
          {editable && <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={save} disabled={!!busy}>{busy === 'guardar' && <Loader2 size={13} className="animate-spin mr-1" />}Guardar configuración</Button>
            {canPlan && <Button size="sm" onClick={plan} disabled={!!busy} className="gap-1.5">{busy === 'planificar' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Investigar y preparar preguntas</Button>}
            {cycle.estado === 'relevamiento' && <>
              <Button variant="outline" size="sm" onClick={() => run('pausar', () => api.post(`/manual-cycles/${cycle.id}/pausar`))} disabled={!!busy} className="gap-1"><CirclePause size={13} /> Pausar</Button>
              <Button size="sm" onClick={() => run('cerrar', () => api.post(`/manual-cycles/${cycle.id}/cerrar-relevamiento`))} disabled={!!busy} className="gap-1 bg-amber-600 hover:bg-amber-700"><SquareCheckBig size={13} /> Finalizar relevamiento</Button>
            </>}
            {cycle.estado === 'pausado' && <Button size="sm" onClick={() => run('reanudar', () => api.post(`/manual-cycles/${cycle.id}/reanudar`))} disabled={!!busy} className="gap-1"><CirclePlay size={13} /> Reanudar</Button>}
          </div>}
        </div>
        {questions.length > 0 && <div className="mt-5 pt-4 border-t">
          <div className="flex items-center justify-between gap-2 mb-2"><p className="text-sm font-semibold flex items-center gap-1.5"><Bot size={14} /> Plan de preguntas</p>{proposed.length > 0 && <Button size="sm" onClick={approveSelected} disabled={!selected.size || !!busy} className="gap-1 h-7 text-xs"><Check size={12} /> Aprobar seleccionadas</Button>}</div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">{questions.map(question => <div key={question.id} className="rounded-lg border p-2.5 text-xs">
            <div className="flex gap-2">{question.estado === 'propuesta' && <input type="checkbox" checked={selected.has(question.id)} onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next })} />}
              <div className="flex-1">
                <Textarea value={question.texto} disabled={question.estado !== 'propuesta' || busy === question.id} rows={2} onChange={event => setQuestions(prev => prev.map(item => item.id === question.id ? { ...item, texto: event.target.value } : item))} className="min-h-0 text-xs" />
                {question.estado === 'propuesta' && <Button type="button" variant="ghost" size="sm" onClick={() => updateQuestion(question)} disabled={!!busy} className="mt-1 h-6 px-2 gap-1 text-[11px]">
                  {busy === question.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Guardar texto
                </Button>}
              </div>
            </div>
            <p className="mt-1 text-muted-foreground">{question.bloque} · {question.tema || 'General'} · {question.estado}</p>
            {question.fuentes?.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{question.fuentes.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="underline">Fuente orientativa</a>)}</div>}
          </div>)}</div>
        </div>}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardContent>}
    </Card>
  )
}

export default function CycleManagement() {
  const [positions, setPositions] = useState([])
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try {
      const [positionsRes, topicsRes] = await Promise.all([api.get('/manual-cycles/puestos'), api.get('/manual-cycles/temas')])
      setPositions(positionsRes.data.data || []); setTopics(topicsRes.data.data || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    window.addEventListener('manual-cycle-changed', load)
    return () => window.removeEventListener('manual-cycle-changed', load)
  }, [])
  if (loading) return <p className="text-sm text-muted-foreground">Cargando ciclos...</p>
  if (!positions.length) return null
  return <section className="mb-8"><div className="mb-3"><h2 className="text-base font-bold" style={{ color: '#1a3a1a' }}>Ciclos de elaboración</h2><p className="text-xs text-muted-foreground">Definí el foco, revisá las preguntas y decidí cuándo hay información suficiente para generar cada manual.</p></div><div className="space-y-3">{positions.map(position => <CycleCard key={`${position.ocupante.id}-${position.funcion}-${position.ciclo?.updatedAt || 'nuevo'}`} position={position} topics={topics} onRefresh={load} />)}</div></section>
}
