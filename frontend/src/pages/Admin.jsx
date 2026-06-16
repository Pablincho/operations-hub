import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { Plus, UserCheck, UserX, Key, Trash2, CheckCircle2, Bug, ChevronDown, ChevronUp, CheckCheck, Trash, ZoomIn, ZoomOut, X } from 'lucide-react'

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [progress, setProgress] = useState({})
  const [primaryOccupants, setPrimaryOccupants] = useState({})
  const [bugs, setBugs] = useState([])
  const [showBugs, setShowBugs] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [zoomImg, setZoomImg] = useState(false)
  const [defaultUserPassword, setDefaultUserPassword] = useState('Bienvenido123')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ nombre: '', email: '', rol: 'operativo', funciones: [] })
  const [pwForm, setPwForm] = useState({ userId: null, password: '' })

  const isSuperAdmin = user?.rol === 'superadmin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [usersRes, progRes, defaultPwRes, bugsRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/checkin/progreso'),
        api.get('/usuarios/default-password'),
        api.get('/bugs')
      ])
      setUsers(usersRes.data.data)
      setPrimaryOccupants(usersRes.data.meta?.primaryOccupants || {})
      setProgress(progRes.data.data)
      setBugs(bugsRes.data.data || [])
      setDefaultUserPassword(defaultPwRes.data?.data?.defaultPassword || 'Bienvenido123')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function createUser() {
    try {
      const res = await api.post('/usuarios', newForm)
      setShowNew(false)
      setNewForm({ nombre: '', email: '', rol: 'operativo', funciones: [] })
      const temp = res.data?.meta?.temporaryPassword
      if (temp) {
        alert(`Usuario creado. Contraseña temporal: ${temp}\nDebe cambiarla en el primer ingreso.`)
      }
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear usuario')
    }
  }

  async function changeSupervisor(u, supervisorId) {
    try {
      await api.patch(`/usuarios/${u.id}/supervisor`, { supervisorId: supervisorId || null })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, supervisorId: supervisorId || null } : x))
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function setPrincipal(funcion, usuarioId) {
    try {
      await api.patch(`/usuarios/funciones/${encodeURIComponent(funcion)}/principal`, { usuarioId: usuarioId || null })
      setPrimaryOccupants(prev => ({ ...prev, [funcion]: usuarioId || null }))
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function toggleFuncion(u, fn) {
    const current = u.funciones || []
    const updated = current.includes(fn) ? current.filter(f => f !== fn) : [...current, fn]
    try {
      await api.patch(`/usuarios/${u.id}/funciones`, { funciones: updated })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, funciones: updated } : x))
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function toggleActive(u) {
    try {
      await api.patch(`/usuarios/${u.id}/activo`, { activo: !u.activo })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, activo: !u.activo } : x))
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function changePassword() {
    if (!pwForm.password.trim()) return
    try {
      await api.patch(`/usuarios/${pwForm.userId}/password`, { password: pwForm.password })
      setPwForm({ userId: null, password: '' })
      alert('Contraseña actualizada')
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function deleteUser(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/usuarios/${u.id}`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function toggleBug(bug) {
    try {
      await api.patch(`/bugs/${bug.id}/resolver`)
      setBugs(prev => prev.map(b => b.id === bug.id ? { ...b, resuelto: !b.resuelto } : b))
    } catch { /* ignore */ }
  }

  async function deleteBug(bug) {
    if (!window.confirm('¿Eliminar este reporte?')) return
    try {
      await api.delete(`/bugs/${bug.id}`)
      setBugs(prev => prev.filter(b => b.id !== bug.id))
    } catch { /* ignore */ }
  }

  function toggleNewFuncion(fn) {
    setNewForm(f => ({
      ...f,
      funciones: f.funciones.includes(fn) ? f.funciones.filter(x => x !== fn) : [...f.funciones, fn]
    }))
  }

  const totalProgress = FUNCIONES.reduce((acc, fn) => acc + (progress[fn] || 0), 0)
  const totalGoal = FUNCIONES.length * 60

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Administración</h1>
          <p className="text-sm text-muted-foreground">Usuarios y progreso de base de conocimiento</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2 text-xs" style={{ background: '#1a3a1a', color: '#e8d5a3' }}>
          <Plus size={14} />
          Nuevo usuario
        </Button>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {FUNCIONES.map(fn => {
          const count = progress[fn] || 0
          const pct = Math.min(100, Math.round((count / 60) * 100))
          return (
            <Card key={fn}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium">{FUNC_ICONS[fn]} {fn}</span>
                  <span className="text-muted-foreground">{count}/60</span>
                </div>
                <Progress value={pct} />
                <p className="text-xs text-muted-foreground mt-1">{pct}% completo</p>
                {(() => {
                  const asignados = users.filter(u => u.activo && (u.funciones || []).includes(fn))
                  if (asignados.length === 0) return null
                  return (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0">Principal:</span>
                      <select
                        value={primaryOccupants[fn] || ''}
                        onChange={e => setPrincipal(fn, e.target.value)}
                        className="text-xs border rounded px-1.5 py-0.5 bg-background flex-1 min-w-0"
                      >
                        <option value="">Auto-detectar</option>
                        {asignados.map(u => (
                          <option key={u.id} value={u.id}>{u.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs text-muted-foreground">Total base de conocimiento:</p>
        <p className="text-xs font-semibold">{totalProgress}/{totalGoal} entradas</p>
        <Progress value={Math.min(100, Math.round((totalProgress / totalGoal) * 100))} className="w-24" />
      </div>

      {/* Users */}
      {loading ? (
        <p className="text-muted-foreground text-sm mt-4">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          {users.map(u => (
            <Card key={u.id} className={u.activo ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{u.nombre}</p>
                      <Badge variant={u.rol === 'superadmin' ? 'default' : u.rol === 'admin' ? 'secondary' : 'outline'} className="text-xs">
                        {u.rol}
                      </Badge>
                      {!u.activo && <Badge variant="destructive" className="text-xs">inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>

                    {/* Supervisor */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Supervisor:</span>
                      <select
                        value={u.supervisorId || ''}
                        onChange={e => changeSupervisor(u, e.target.value)}
                        className="text-xs border rounded px-2 py-0.5 bg-background flex-1 min-w-0"
                      >
                        <option value="">Sin supervisor</option>
                        {users
                          .filter(s => ['admin', 'superadmin'].includes(s.rol) && s.id !== u.id)
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.nombre} ({s.rol})</option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Function toggles */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {FUNCIONES.map(fn => {
                        const has = (u.funciones || []).includes(fn)
                        const canEdit = true
                        return (
                          <button
                            key={fn}
                            onClick={() => canEdit && toggleFuncion(u, fn)}
                            disabled={!canEdit}
                            className="text-xs px-2 py-0.5 rounded-full border font-medium transition-colors"
                            style={has ? {
                              background: FUNC_COLORS[fn],
                              color: 'white',
                              borderColor: FUNC_COLORS[fn]
                            } : {
                              background: 'transparent',
                              color: '#999',
                              borderColor: '#ddd'
                            }}
                          >
                            {FUNC_ICONS[fn]} {fn}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {u.id !== user?.id && (
                      <>
                        <button
                          onClick={() => toggleActive(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {u.activo ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                        <button
                          onClick={() => setPwForm({ userId: u.id, password: '' })}
                          title="Cambiar contraseña"
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Key size={15} />
                        </button>
                        {u.rol !== 'superadmin' && (
                          <button
                            onClick={() => deleteUser(u)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bug reports */}
      <div className="mt-6 border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowBugs(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bug size={15} className="text-amber-600" />
            <span className="text-sm font-medium">Reportes de problemas</span>
            {bugs.filter(b => !b.resuelto).length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                {bugs.filter(b => !b.resuelto).length} sin resolver
              </span>
            )}
          </div>
          {showBugs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showBugs && (
          <div className="divide-y">
            {bugs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay reportes todavía.</p>
            ) : bugs.map(bug => (
              <div key={bug.id} className={`p-4 ${bug.resuelto ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium">{bug.Usuario?.nombre || 'Usuario eliminado'}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${bug.resuelto ? 'bg-gray-100 text-gray-400' : bug.tipo === 'mejora' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {bug.tipo === 'mejora' ? '💡 Mejora' : '🐛 Problema'}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{bug.pagina}</span>
                      <span className="text-xs text-muted-foreground">{new Date(bug.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      {bug.resuelto && <span className="text-xs text-green-600 font-medium">✓ Resuelto</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{bug.texto}</p>
                    {bug.imagen && (
                      <button
                        onClick={() => { setLightboxImg(bug.imagen); setZoomImg(false) }}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        Ver captura
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleBug(bug)}
                      title={bug.resuelto ? 'Reabrir' : 'Marcar resuelto'}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-green-600"
                    >
                      <CheckCheck size={15} />
                    </button>
                    <button
                      onClick={() => deleteBug(bug)}
                      title="Eliminar"
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => { setLightboxImg(null); setZoomImg(false) }}>
          <div className="absolute top-3 right-3 flex gap-1 z-10">
            <button
              onClick={e => { e.stopPropagation(); setZoomImg(v => !v) }}
              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
              title={zoomImg ? 'Ajustar al tamaño' : 'Zoom'}
            >
              {zoomImg ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setLightboxImg(null); setZoomImg(false) }}
              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          {zoomImg ? (
            <div className="absolute inset-0 overflow-auto" onClick={e => e.stopPropagation()}>
              <img
                src={lightboxImg}
                alt="captura"
                onClick={() => setZoomImg(false)}
                className="block cursor-zoom-out rounded-lg"
                style={{ width: '200%', height: 'auto' }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <img
                src={lightboxImg}
                alt="captura"
                onClick={() => setZoomImg(true)}
                className="max-w-[90vw] max-h-[90vh] object-contain cursor-zoom-in rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      {/* New user dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Nombre" value={newForm.nombre} onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))} />
            <Input type="email" placeholder="Email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
            <p className="text-xs text-muted-foreground">
              Se asignará una contraseña temporal ({defaultUserPassword}) y el usuario deberá cambiarla al ingresar.
            </p>
            <div>
              <label className="text-xs font-medium mb-1 block">Funciones</label>
              <div className="flex flex-wrap gap-2">
                {FUNCIONES.map(fn => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => toggleNewFuncion(fn)}
                    className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors"
                    style={newForm.funciones.includes(fn) ? {
                      background: FUNC_COLORS[fn], color: 'white', borderColor: FUNC_COLORS[fn]
                    } : { background: 'transparent', color: '#666', borderColor: '#ccc' }}
                  >
                    {FUNC_ICONS[fn]} {fn}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={createUser} style={{ background: '#1a3a1a', color: '#e8d5a3' }}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={!!pwForm.userId} onOpenChange={() => setPwForm({ userId: null, password: '' })}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Asignar contraseña temporal</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Contraseña temporal"
            value={pwForm.password}
            onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwForm({ userId: null, password: '' })}>Cancelar</Button>
            <Button onClick={changePassword} style={{ background: '#1a3a1a', color: '#e8d5a3' }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
