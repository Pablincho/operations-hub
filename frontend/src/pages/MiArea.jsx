import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { Plus, Pencil, Trash2, Lock, ChevronDown, ChevronUp } from 'lucide-react'

const CATEGORIAS = ['general', 'procedimiento', 'contacto', 'acceso', 'checkin']

export default function MiArea() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterFn, setFilterFn] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const isSuperAdmin = user?.rol === 'superadmin'
  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)
  const funciones = user?.funciones || []

  const [form, setForm] = useState({
    funcion: funciones[0] || '',
    categoria: 'general',
    titulo: '',
    contenido: '',
    esSensible: false
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (filterFn !== 'all') params.funcion = filterFn
      if (filterCat !== 'all') params.categoria = filterCat
      const res = await api.get('/knowledge', { params })
      setEntries(res.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterFn, filterCat])

  function openNew() {
    setEditEntry(null)
    setForm({ funcion: funciones[0] || FUNCIONES[0], categoria: 'general', titulo: '', contenido: '', esSensible: false })
    setShowForm(true)
  }

  function openEdit(e) {
    setEditEntry(e)
    setForm({ funcion: e.funcion, categoria: e.categoria, titulo: e.titulo, contenido: e.contenido, esSensible: e.esSensible })
    setShowForm(true)
  }

  async function saveForm() {
    try {
      if (editEntry) {
        await api.put(`/knowledge/${editEntry.id}`, form)
      } else {
        await api.post('/knowledge', form)
      }
      setShowForm(false)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function confirmDelete(entry) {
    if (!window.confirm(`¿Eliminar "${entry.titulo}"?`)) return
    setDeleting(entry.id)
    try {
      await api.delete(`/knowledge/${entry.id}`)
      load()
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  // Determine which functions the user can see
  const visibleFunctions = isSuperAdmin ? FUNCIONES : (isAdmin ? FUNCIONES : funciones)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Mi Área</h1>
          <p className="text-sm text-muted-foreground">Base de conocimiento operativo</p>
        </div>
        <Button onClick={openNew} className="gap-2 text-xs" style={{ background: '#1a3a1a', color: '#e8d5a3' }}>
          <Plus size={14} />
          Agregar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterFn}
          onChange={e => setFilterFn(e.target.value)}
          className="text-xs border rounded-lg px-3 py-1.5 bg-background"
        >
          <option value="all">Todas las funciones</option>
          {visibleFunctions.map(fn => (
            <option key={fn} value={fn}>{FUNC_ICONS[fn]} {fn}</option>
          ))}
        </select>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="text-xs border rounded-lg px-3 py-1.5 bg-background"
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Entries */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No hay entradas con este filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(entry => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div
                  className="flex items-start gap-2 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white font-medium shrink-0"
                    style={{ background: FUNC_COLORS[entry.funcion] }}
                  >
                    {FUNC_ICONS[entry.funcion]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{entry.titulo}</p>
                      {entry.esSensible && <Lock size={12} className="text-destructive shrink-0" />}
                      <Badge variant="outline" className="text-xs py-0 px-1.5 shrink-0">{entry.categoria}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.funcion}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!entry._bloqueado && (
                      <>
                        <button onClick={e => { e.stopPropagation(); openEdit(entry) }} className="p-1 hover:text-foreground text-muted-foreground">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); confirmDelete(entry) }}
                          disabled={deleting === entry.id}
                          className="p-1 hover:text-destructive text-muted-foreground"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {expandedId === entry.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
                {expandedId === entry.id && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {entry._bloqueado
                        ? <span className="text-muted-foreground italic">🔒 Información sensible restringida</span>
                        : entry.contenido}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Editar entrada' : 'Nueva entrada'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Función</label>
                <select
                  value={form.funcion}
                  onChange={e => setForm(f => ({ ...f, funcion: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2 py-1.5 bg-background"
                >
                  {(isSuperAdmin ? FUNCIONES : funciones).map(fn => (
                    <option key={fn} value={fn}>{FUNC_ICONS[fn]} {fn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2 py-1.5 bg-background"
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Título</label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Nombre del procedimiento o acceso" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Contenido</label>
              <Textarea
                value={form.contenido}
                onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                rows={5}
                placeholder="Describí el procedimiento, datos de acceso, etc."
              />
            </div>
            {isSuperAdmin && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.esSensible}
                  onChange={e => setForm(f => ({ ...f, esSensible: e.target.checked }))}
                />
                <Lock size={14} className="text-destructive" />
                Información sensible (solo visible para superadmin)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={saveForm} style={{ background: '#1a3a1a', color: '#e8d5a3' }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
