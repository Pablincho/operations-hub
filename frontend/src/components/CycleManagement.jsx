import { useEffect, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronUp, CirclePause, CirclePlay, Loader2, LockKeyhole, Plus, Save, Search, Settings2, SlidersHorizontal, SquareCheckBig } from 'lucide-react'
import api, { getShared } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATE_LABELS = {
  configuracion: 'Configuración', planificando: 'Agentes trabajando', relevamiento: 'Relevamiento activo',
  listo_para_generar: 'Listo para generar', generando: 'Generando y verificando', borrador: 'Borrador generado',
  en_revision: 'Manual en revisión', completado: 'Ciclo completado', pausado: 'Pausado'
}

const LOCK_REASONS = {
  planificando: 'La configuración está bloqueada mientras los agentes preparan la tanda.',
  listo_para_generar: 'El relevamiento ya fue cerrado. Solo una devolución por falta de conocimiento puede reabrirlo.',
  generando: 'La configuración está bloqueada mientras se genera y verifica el manual.',
  borrador: 'El relevamiento terminó y el operativo está trabajando con el borrador.',
  en_revision: 'El manual está en revisión. Los datos quedan congelados para conservar la evidencia que originó el borrador.'
}

const QUESTION_STATE_LABELS = {
  propuesta: 'Propuesta',
  aprobada: 'Lista para enviar',
  preguntada: 'Entregada',
  respondida: 'Respondida',
  rechazada: 'Rechazada'
}

const FIELD_HELP = {
  preguntasPorEntrega: 'Cantidad máxima de preguntas que recibe el operativo en cada check-in.',
  frecuencia: 'Define la periodicidad mínima con la que el operativo puede recibir una nueva tanda.',
  intervaloDias: 'Multiplica la frecuencia elegida: por ejemplo, 2 con frecuencia diaria significa cada 2 días.',
  objetivoPreguntas: 'Límite total de preguntas que pueden preparar los agentes en este ciclo. No cierra el ciclo automáticamente; el supervisor decide cuándo finalizarlo.'
}

function GeneralCycleConfig({ config, editableCycles, onSaved }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    preguntasPorEntrega: 3,
    frecuencia: 'diaria',
    intervaloDias: 1,
    objetivoPreguntas: '',
    requiereAprobacionPreguntas: false,
    permitirResponderTodas: false,
    aplicarACiclos: true
  })

  function abrir() {
    setForm({
      preguntasPorEntrega: config?.preguntasPorEntrega ?? 3,
      frecuencia: config?.frecuencia || 'diaria',
      intervaloDias: config?.intervaloDias ?? 1,
      objetivoPreguntas: config?.objetivoPreguntas ?? '',
      requiereAprobacionPreguntas: config?.requiereAprobacionPreguntas ?? false,
      permitirResponderTodas: config?.permitirResponderTodas ?? false,
      aplicarACiclos: true
    })
    setError('')
    setOpen(true)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await api.patch('/manual-cycles/configuracion-general', form)
      await onSaved(res.data.data)
      setOpen(false)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la configuración general')
    } finally { setSaving(false) }
  }

  return (
    <>
      <Card className="mb-3 border-dashed" data-tour="revisiones-general">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><SlidersHorizontal size={14} /> Configuración general</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Definí una vez la entrega, frecuencia, límite y revisión de preguntas para todos tus supervisados.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={abrir} className="shrink-0 gap-1.5">
            <Settings2 size={13} /> Configurar todos
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl">
          <DialogHeader><DialogTitle>Configuración general de ciclos</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Estos valores se usarán como base para tus próximos ciclos. Los temas y la orientación se mantienen por puesto.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label title={FIELD_HELP.preguntasPorEntrega} className="text-xs cursor-help">Preguntas por entrega<Input type="number" min="1" max="10" value={form.preguntasPorEntrega} onChange={event => setForm(prev => ({ ...prev, preguntasPorEntrega: event.target.value }))} className="mt-1" /></label>
            <label title={FIELD_HELP.frecuencia} className="text-xs cursor-help">Frecuencia<select value={form.frecuencia} onChange={event => setForm(prev => ({ ...prev, frecuencia: event.target.value }))} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="manual">Sin espera mínima</option></select></label>
            <label title={`${FIELD_HELP.intervaloDias}${form.frecuencia === 'manual' ? ' No se utiliza cuando la frecuencia es sin espera mínima.' : ''}`} className={`text-xs ${form.frecuencia === 'manual' ? 'cursor-not-allowed' : 'cursor-help'}`}>Cada cuántos períodos<Input type="number" min="1" max="30" value={form.intervaloDias} disabled={form.frecuencia === 'manual'} onChange={event => setForm(prev => ({ ...prev, intervaloDias: event.target.value }))} className={`mt-1 ${form.frecuencia === 'manual' ? 'cursor-not-allowed' : ''}`} /></label>
            <label title={FIELD_HELP.objetivoPreguntas} className="text-xs cursor-help">Límite de preguntas<Input type="number" min="1" placeholder="Sin límite" value={form.objetivoPreguntas} onChange={event => setForm(prev => ({ ...prev, objetivoPreguntas: event.target.value }))} className="mt-1" /></label>
          </div>
          <label className="flex items-start gap-2 text-sm rounded-lg border p-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={form.requiereAprobacionPreguntas} onChange={event => setForm(prev => ({ ...prev, requiereAprobacionPreguntas: event.target.checked }))} />
            <span><strong className="block text-xs">Revisar cada tanda antes de enviarla</strong><span className="text-xs text-muted-foreground">Las preguntas propuestas por los agentes quedarán esperando tu aprobación.</span></span>
          </label>
          <label title="Cuando estÃ¡ activo, el operativo puede elegir responder todas las preguntas pendientes, ademÃ¡s de la tanda habitual." className="flex items-start gap-2 text-sm rounded-lg border p-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={form.permitirResponderTodas} onChange={event => setForm(prev => ({ ...prev, permitirResponderTodas: event.target.checked }))} />
            <span><strong className="block text-xs">Permitir responder todas las preguntas aprobadas</strong><span className="text-xs text-muted-foreground">El operativo podrÃ¡ elegir completar todas las preguntas pendientes, ademÃ¡s de la cantidad habitual por entrega.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm rounded-lg border border-blue-200 bg-blue-50 p-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={form.aplicarACiclos} onChange={event => setForm(prev => ({ ...prev, aplicarACiclos: event.target.checked }))} />
            <span><strong className="block text-xs">Aplicar también a los ciclos editables actuales</strong><span className="text-xs text-muted-foreground">Actualizará {editableCycles} ciclo{editableCycles === 1 ? '' : 's'} en configuración, relevamiento o pausa. Los ciclos bloqueados no se modificarán.</span></span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar configuración general
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CycleCard({ position, topics, onRefresh, isFirst = false }) {
  const cycle = position.ciclo
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(() => ({
    temas: cycle?.temas || [], orientacion: cycle?.orientacion || '', heredarOrientacion: cycle?.heredarOrientacion ?? true,
    preguntasPorEntrega: cycle?.preguntasPorEntrega || 3, frecuencia: cycle?.frecuencia || 'diaria',
    intervaloDias: cycle?.intervaloDias || 1, objetivoPreguntas: cycle?.objetivoPreguntas || '',
    requiereAprobacionPreguntas: cycle?.requiereAprobacionPreguntas ?? false,
    permitirResponderTodas: cycle?.permitirResponderTodas ?? false
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
      await api.post(`/manual-cycles/${cycle.id}/planificar`, null, {
        agentActivity: {
          titulo: 'Preparando preguntas',
          descripcion: 'Los agentes están revisando la cobertura, consultando fuentes orientativas y preparando la próxima tanda.'
        }
      })
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

  async function closeRelevamiento() {
    const approvedCount = questions.filter(question => question.estado === 'aprobada').length
    const warning = approvedCount
      ? `Quedan ${approvedCount} pregunta${approvedCount === 1 ? '' : 's'} aprobada${approvedCount === 1 ? '' : 's'} sin responder. Al finalizar, el operativo ya no podrá responderlas en este ciclo.\n\n¿Querés finalizar el relevamiento de todos modos?`
      : 'Al finalizar se detendrán nuevos check-ins y el operativo podrá generar o actualizar el manual con la evidencia reunida.\n\n¿Querés finalizar el relevamiento?'
    if (!window.confirm(warning)) return
    await run('cerrar', () => api.post(`/manual-cycles/${cycle.id}/cerrar-relevamiento`))
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
  const approved = questions.filter(question => question.estado === 'aprobada')
  const reachedQuestionLimit = cycle.objetivoPreguntas !== null && questions.length >= cycle.objetivoPreguntas
  const editable = ['configuracion', 'relevamiento', 'pausado'].includes(cycle.estado)
  const canPlan = ['configuracion', 'relevamiento'].includes(cycle.estado)
  const lockReason = LOCK_REASONS[cycle.estado] || 'Este ciclo ya no admite cambios.'
  const fieldTitle = help => editable ? help : `${help} ${lockReason}`
  const questionLockReason = question => {
    if (question.estado === 'aprobada') {
      return 'Esta pregunta ya está lista para enviar al operativo y no se edita para conservar la trazabilidad. Si querés revisar o modificar las preguntas antes de enviarlas, activá “Revisar cada tanda antes de enviarla” antes de preparar la próxima tanda.'
    }
    if (question.estado === 'preguntada' || question.estado === 'respondida') {
      return 'Esta pregunta ya fue entregada al operativo y forma parte de la evidencia del ciclo; no puede modificarse.'
    }
    return `No se puede editar: la pregunta está en estado “${QUESTION_STATE_LABELS[question.estado] || question.estado}”.`
  }

  return (
    <Card className="overflow-hidden" data-tour={isFirst ? 'revisiones-ciclo' : undefined}>
      <button onClick={() => setExpanded(value => !value)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="flex-1"><p className="text-sm font-semibold">{position.funcion} · ciclo {cycle.numero}</p><p className="text-xs text-muted-foreground">{position.ocupante.nombre} · {STATE_LABELS[cycle.estado] || cycle.estado} · {cycle.respuestasCiclo || 0} respuestas</p></div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && <CardContent className="px-4 pb-4 pt-0 border-t">
        <div className="pt-4">
          {!editable && <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" />
            <div><p className="text-xs font-semibold">Configuración bloqueada</p><p className="text-xs mt-0.5">{lockReason}</p></div>
          </div>}
          <div className="flex items-center gap-2 mb-3"><Settings2 size={15} /><p className="text-sm font-semibold">Orientación de las próximas preguntas</p></div>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {topics.map(topic => <label key={topic} title={!editable ? lockReason : undefined} className={`flex items-start gap-2 text-xs rounded-lg border p-2.5 ${editable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
              <input type="checkbox" checked={form.temas.includes(topic)} disabled={!editable} onChange={() => toggleTopic(topic)} className="mt-0.5" />{topic}
            </label>)}
          </div>
          <div title={!editable ? lockReason : undefined} className={!editable ? 'cursor-not-allowed' : ''}>
            <Textarea value={form.orientacion} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, orientacion: event.target.value }))} placeholder="Escribí cualquier criterio, situación o aspecto particular que quieras investigar..." rows={3} className={!editable ? 'cursor-not-allowed' : ''} />
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-3">
            <label title={fieldTitle(FIELD_HELP.preguntasPorEntrega)} className={`text-xs ${!editable ? 'cursor-not-allowed' : 'cursor-help'}`}>Preguntas por entrega<Input type="number" min="1" max="10" value={form.preguntasPorEntrega} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, preguntasPorEntrega: event.target.value }))} className={`mt-1 ${!editable ? 'cursor-not-allowed' : ''}`} /></label>
            <label title={fieldTitle(FIELD_HELP.frecuencia)} className={`text-xs ${!editable ? 'cursor-not-allowed' : 'cursor-help'}`}>Frecuencia<select value={form.frecuencia} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, frecuencia: event.target.value }))} className={`mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm ${!editable ? 'cursor-not-allowed' : ''}`}><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="manual">Sin espera mínima</option></select></label>
            <label title={fieldTitle(`${FIELD_HELP.intervaloDias}${form.frecuencia === 'manual' ? ' No se utiliza cuando la frecuencia es sin espera mínima.' : ''}`)} className={`text-xs ${!editable || form.frecuencia === 'manual' ? 'cursor-not-allowed' : 'cursor-help'}`}>Cada cuántos períodos<Input type="number" min="1" max="30" value={form.intervaloDias} disabled={!editable || form.frecuencia === 'manual'} onChange={event => setForm(prev => ({ ...prev, intervaloDias: event.target.value }))} className={`mt-1 ${!editable || form.frecuencia === 'manual' ? 'cursor-not-allowed' : ''}`} /></label>
            <label title={fieldTitle(FIELD_HELP.objetivoPreguntas)} className={`text-xs ${!editable ? 'cursor-not-allowed' : 'cursor-help'}`}>Límite de preguntas<Input type="number" min="1" placeholder="Sin límite" value={form.objetivoPreguntas} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, objetivoPreguntas: event.target.value }))} className={`mt-1 ${!editable ? 'cursor-not-allowed' : ''}`} /></label>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs">
            <label title={!editable ? lockReason : 'Las preguntas propuestas por los agentes quedan esperando tu aprobación antes de enviarse al operativo.'} className={`flex items-center gap-2 ${!editable ? 'cursor-not-allowed opacity-70' : 'cursor-help'}`}><input type="checkbox" checked={form.requiereAprobacionPreguntas} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, requiereAprobacionPreguntas: event.target.checked }))} />Revisar cada tanda antes de enviarla</label>
            <label title={!editable ? lockReason : 'Cuando está activo, el operativo puede elegir responder todas las preguntas aprobadas pendientes, además de la tanda habitual.'} className={`flex items-center gap-2 ${!editable ? 'cursor-not-allowed opacity-70' : 'cursor-help'}`}><input type="checkbox" checked={form.permitirResponderTodas} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, permitirResponderTodas: event.target.checked }))} />Permitir responder todas las aprobadas</label>
            <label title={!editable ? lockReason : 'Conserva los temas y la orientación de este ciclo como punto de partida del siguiente. Podrás modificarlos antes de iniciar las nuevas preguntas.'} className={`flex items-center gap-2 ${!editable ? 'cursor-not-allowed opacity-70' : 'cursor-help'}`}><input type="checkbox" checked={form.heredarOrientacion} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, heredarOrientacion: event.target.checked }))} />Heredar esta orientación al próximo ciclo</label>
          </div>
          {editable && <div className="mt-4 space-y-3">
            {cycle.estado === 'relevamiento' && (
              <div className={`rounded-lg border px-3 py-2.5 text-xs ${approved.length ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-muted bg-muted/30 text-muted-foreground'}`}>
                {approved.length
                  ? <><strong>{approved.length} pregunta{approved.length === 1 ? '' : 's'} aprobada{approved.length === 1 ? '' : 's'} pendiente{approved.length === 1 ? '' : 's'} de respuesta.</strong> El operativo puede continuar respondiéndola{approved.length === 1 ? '' : 's'} sin que hagas nada más.</>
                  : <>No hay preguntas aprobadas pendientes de respuesta. Podés preparar una nueva tanda o finalizar el relevamiento cuando la evidencia sea suficiente.</>}
              </div>
            )}
            <div className={`grid gap-3 ${cycle.estado === 'relevamiento' ? 'sm:grid-cols-2' : ''}`}>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold">Ampliar relevamiento</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Prepará una tanda adicional; no modifica las preguntas ya aprobadas ni interrumpe al operativo.</p>
                {canPlan && (reachedQuestionLimit ? (
                  <p className="mt-2 text-xs text-muted-foreground">Ya se alcanzó el límite de {cycle.objetivoPreguntas} preguntas ({questions.length} planificadas). Aumentalo si querés preparar una tanda adicional.</p>
                ) : proposed.length ? (
                  <p className="mt-2 text-xs text-amber-700">Hay {proposed.length} pregunta{proposed.length === 1 ? '' : 's'} propuesta{proposed.length === 1 ? '' : 's'} esperando tu revisión. Revisala{proposed.length === 1 ? '' : 's'} antes de preparar otra tanda.</p>
                ) : (
                  <Button size="sm" onClick={plan} disabled={!!busy} title={cycle.requiereAprobacionPreguntas ? 'Los agentes investigan y proponen una tanda adicional. Podrás revisarla, editarla y aprobarla antes de que llegue al operativo.' : 'Los agentes investigan y preparan una tanda adicional que quedará lista para enviar al operativo.'} className="mt-2 gap-1.5">{busy === 'planificar' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}{questions.length ? 'Preparar preguntas adicionales' : 'Preparar primera tanda'}</Button>
                ))}
              </div>
              {cycle.estado === 'relevamiento' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">Cerrar este ciclo</p>
                <p className="mt-0.5 text-xs text-amber-800">Detiene nuevos check-ins y habilita al operativo a generar o actualizar el manual con la evidencia reunida.</p>
                <Button size="sm" onClick={closeRelevamiento} disabled={!!busy} title="Antes de cerrar te avisaremos si quedan preguntas aprobadas sin responder." className="mt-2 gap-1 bg-amber-600 hover:bg-amber-700"><SquareCheckBig size={13} /> Finalizar relevamiento</Button>
              </div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={save} disabled={!!busy} title="Guarda los valores del ciclo, pero no genera ni envía preguntas.">{busy === 'guardar' && <Loader2 size={13} className="animate-spin mr-1" />}Guardar configuración</Button>
              {cycle.estado === 'relevamiento' && <Button variant="outline" size="sm" onClick={() => run('pausar', () => api.post(`/manual-cycles/${cycle.id}/pausar`))} disabled={!!busy} title="Detiene temporalmente los próximos check-ins. No se pierde ninguna pregunta ni respuesta del ciclo." className="gap-1"><CirclePause size={13} /> Pausar</Button>}
              {cycle.estado === 'pausado' && <Button size="sm" onClick={() => run('reanudar', () => api.post(`/manual-cycles/${cycle.id}/reanudar`))} disabled={!!busy} title="Vuelve a habilitar los check-ins de este ciclo para el operativo." className="gap-1"><CirclePlay size={13} /> Reanudar</Button>}
            </div>
          </div>}
        </div>
        {questions.length > 0 && <div className="mt-5 pt-4 border-t">
          <div className="flex items-center justify-between gap-2 mb-2"><p className="text-sm font-semibold flex items-center gap-1.5"><Bot size={14} /> Plan de preguntas</p>{proposed.length > 0 && <Button size="sm" onClick={approveSelected} disabled={!selected.size || !!busy} className="gap-1 h-7 text-xs"><Check size={12} /> Aprobar seleccionadas</Button>}</div>
        <div className="space-y-2 max-h-80 overflow-auto pr-1">{questions.map(question => <div key={question.id} title={question.estado !== 'propuesta' ? questionLockReason(question) : undefined} className={`rounded-lg border p-2.5 text-xs ${question.estado !== 'propuesta' ? 'cursor-not-allowed bg-muted/20' : ''}`}>
            <div className="flex gap-2">{question.estado === 'propuesta' && <input type="checkbox" checked={selected.has(question.id)} onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next })} />}
              <div className="flex-1">
                <Textarea value={question.texto} disabled={question.estado !== 'propuesta' || busy === question.id} title={question.estado !== 'propuesta' ? questionLockReason(question) : undefined} rows={2} onChange={event => setQuestions(prev => prev.map(item => item.id === question.id ? { ...item, texto: event.target.value } : item))} className={`min-h-0 text-xs ${question.estado !== 'propuesta' ? 'cursor-not-allowed' : ''}`} />
                {question.estado === 'propuesta' && <Button type="button" variant="ghost" size="sm" onClick={() => updateQuestion(question)} disabled={!!busy} className="mt-1 h-6 px-2 gap-1 text-[11px]">
                  {busy === question.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Guardar texto
                </Button>}
              </div>
            </div>
            <p className="mt-1 text-muted-foreground flex items-center gap-1">{question.estado !== 'propuesta' && <LockKeyhole size={11} />}{question.bloque} · {question.tema || 'General'} · {QUESTION_STATE_LABELS[question.estado] || question.estado}</p>
            {question.fuentes?.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{question.fuentes.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="underline">Fuente orientativa</a>)}</div>}
          </div>)}</div>
        </div>}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardContent>}
    </Card>
  )
}

export default function CycleManagement({ onLoadingChange, hidden = false }) {
  const [positions, setPositions] = useState([])
  const [topics, setTopics] = useState([])
  const [generalConfig, setGeneralConfig] = useState(null)
  const [generalMessage, setGeneralMessage] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { onLoadingChange?.(loading) }, [loading, onLoadingChange])
  async function load() {
    setLoading(true)
    try {
      const [puestos, temas, config] = await Promise.all([
        getShared('/manual-cycles/puestos'),
        getShared('/manual-cycles/temas'),
        getShared('/manual-cycles/configuracion-general')
      ])
      setPositions(puestos.data || []); setTopics(temas.data || []); setGeneralConfig(config.data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    window.addEventListener('manual-cycle-changed', load)
    return () => window.removeEventListener('manual-cycle-changed', load)
  }, [])
  if (loading || hidden) return null
  if (!positions.length) return null
  const editableCycles = positions.filter(position => ['configuracion', 'relevamiento', 'pausado'].includes(position.ciclo?.estado)).length
  return <section className="mb-8"><div className="mb-3"><h2 className="text-base font-bold" style={{ color: '#1a3a1a' }}>Ciclos de elaboración</h2><p className="text-xs text-muted-foreground">Definí el foco, revisá las preguntas y decidí cuándo hay información suficiente para generar cada manual.</p></div><GeneralCycleConfig config={generalConfig} editableCycles={editableCycles} onSaved={async result => { setGeneralMessage(result.appliedCycles ? `Configuración guardada y aplicada a ${result.appliedCycles} ciclo${result.appliedCycles === 1 ? '' : 's'}.` : 'Configuración general guardada.'); await load() }} />{generalMessage && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{generalMessage}</p>}<div className="space-y-3">{positions.map((position, index) => <CycleCard key={`${position.ocupante.id}-${position.funcion}-${position.ciclo?.updatedAt || 'nuevo'}`} position={position} topics={topics} onRefresh={load} isFirst={index === 0} />)}</div></section>
}
