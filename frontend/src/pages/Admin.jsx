import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { useTour } from '@/lib/tour'
import { Plus, UserCheck, UserX, Key, Trash2, Bug, ChevronDown, ChevronUp, CheckCheck, Trash, ZoomIn, ZoomOut, X, Palmtree, HelpCircle } from 'lucide-react'

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [progress, setProgress] = useState({})
  const [cycleStatusMap, setCycleStatusMap] = useState({})
  const [primaryOccupants, setPrimaryOccupants] = useState({})
  const [functionCatalog, setFunctionCatalog] = useState([])
  const [bugs, setBugs] = useState([])
  const [showBugs, setShowBugs] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [zoomImg, setZoomImg] = useState(false)
  const [defaultUserPassword, setDefaultUserPassword] = useState('Bienvenido123')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [newFunctionName, setNewFunctionName] = useState('')
  const [newForm, setNewForm] = useState({ nombre: '', email: '', rol: 'operativo', funciones: [] })
  const [pwForm, setPwForm] = useState({ userId: null, password: '' })


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
      setFunctionCatalog(usersRes.data.meta?.funcionesCatalogo || [])
      setProgress(progRes.data.data)
      setCycleStatusMap(progRes.data.cycleStatusMap || {})
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

  async function changeSupervisor(u, value) {
    const autoaprobarManual = value === '__auto__'
    const supervisorId = autoaprobarManual ? null : (value || null)
    try {
      await api.patch(`/usuarios/${u.id}/supervisor`, { supervisorId, autoaprobarManual })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, supervisorId, autoaprobarManual } : x))
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

  async function createFunction() {
    if (!newFunctionName.trim()) return
    try {
      await api.post('/organizacion/funciones', { nombre: newFunctionName })
      setNewFunctionName('')
      await load()
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo crear el puesto')
    }
  }

  async function renameFunction(entry) {
    const nombre = window.prompt('Nuevo nombre del puesto', entry.nombre)?.trim()
    if (!nombre || nombre === entry.nombre) return
    try {
      await api.patch(`/organizacion/funciones/${encodeURIComponent(entry.nombre)}`, { nombre })
      await load()
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo renombrar el puesto')
    }
  }

  async function toggleCatalogFunction(entry) {
    try {
      await api.patch(`/organizacion/funciones/${encodeURIComponent(entry.nombre)}`, { activo: !entry.activo })
      await load()
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo actualizar el puesto')
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

  async function toggleVacaciones(u) {
    try {
      await api.patch(`/usuarios/${u.id}/vacaciones`, { enVacaciones: !u.enVacaciones })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, enVacaciones: !u.enVacaciones } : x))
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
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Se desactiva su cuenta (igual que "Desactivar") y se conserva su historial; podés reactivarlo después.`)) return
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

  const funciones = functionCatalog.filter(entry => entry.activo).map(entry => entry.nombre)
  const totalProgress = funciones.reduce((acc, fn) => acc + (progress[fn] || 0), 0)
  // Los botones de acción (vacaciones/activar/password/eliminar) no se muestran para
  // tu propia fila, así que el tour los ancla a la primera fila que sea OTRO usuario.
  const primerOtroUsuarioId = users.find(u => u.id !== user?.id)?.id

  const { replay: verTour } = useTour({
    tourId: 'admin',
    userId: user?.id,
    listo: !loading && !!user,
    steps: [
      {
        popover: {
          title: 'Administración',
          description: 'Desde acá gestionás usuarios, funciones asignadas, supervisores y el progreso de la base de conocimiento.'
        }
      },
      {
        element: '[data-tour="admin-progreso"]',
        popover: {
          title: 'Progreso por función',
          description: 'Muestra las respuestas del ciclo actual de cada puesto. Si hay un límite, el avance se calcula sobre ese máximo de preguntas; el supervisor decide la orientación y cuándo iniciar o cerrar cada ciclo. El selector "Principal" define quién responde cuando hay más de una persona con esa función.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="admin-nuevo"]',
        popover: {
          title: 'Crear usuario',
          description: 'Da de alta un usuario con una contraseña temporal (la ves antes de crearlo). Va a tener que cambiarla obligatoriamente en su primer ingreso.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-tour="admin-supervisor"]',
        popover: {
          title: 'Supervisor',
          description: 'Elegí quién revisa y aprueba el manual de este usuario. Si no debería tener revisor (por ejemplo, el Gerente General, que está en la punta de la jerarquía), elegí "Autoaprobación": va a poder publicar su propio manual sin pasar por revisión.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="admin-funciones"]',
        popover: {
          title: 'Funciones asignadas',
          description: 'Click para asignar o quitar una función. Cada función tiene su propio ciclo, preguntas, evidencia y manual; asignala solo cuando corresponda al trabajo real de esa persona.',
          side: 'bottom'
        }
      },
      {
        element: '[data-tour="admin-acciones"]',
        popover: {
          title: 'Acciones rápidas',
          description: 'La palmera marca a alguien de vacaciones: mientras dure, no le llegan notificaciones de check-in y los días no corren. Al lado podés desactivarlo o eliminarlo (ambos hacen lo mismo: bloquean su acceso sin borrar su información, y se puede reactivar después), o asignarle una contraseña temporal nueva.',
          side: 'top'
        }
      },
      {
        element: '[data-tour="admin-bugs"]',
        popover: {
          title: 'Reportes de problemas',
          description: 'Los problemas y sugerencias que cualquier usuario reporta desde el ícono de bug (arriba a la derecha, en cualquier pantalla) aparecen acá, con su página de origen y una captura si adjuntaron una. Podés marcarlos como resueltos o eliminarlos.',
          side: 'top'
        }
      }
    ]
  })

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Administración</h1>
          <p className="text-sm text-muted-foreground">Usuarios y progreso de base de conocimiento</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={verTour}
            title="Ver cómo funciona"
            className="flex items-center justify-center shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <HelpCircle size={14} />
          </button>
          <Button data-tour="admin-nuevo" onClick={() => setShowNew(true)} className="gap-2 text-xs" style={{ background: '#1a3a1a', color: '#e8d5a3' }}>
            <Plus size={14} />
            Nuevo usuario
          </Button>
          <Button variant="outline" onClick={() => setShowCatalog(true)} className="gap-2 text-xs">
            Gestionar puestos
          </Button>
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-tour="admin-progreso">
        {funciones.map(fn => {
          const count = progress[fn] || 0
          const target = cycleStatusMap[fn]?.objetivoPreguntas
          const pct = target ? Math.min(100, Math.round((count / target) * 100)) : 0
          return (
            <Card key={fn}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium">{FUNC_ICONS[fn]} {fn}</span>
                  <span className="text-muted-foreground">{count}{target ? `/${target}` : ''}</span>
                </div>
                {target && <Progress value={pct} />}
                <p className="text-xs text-muted-foreground mt-1">{cycleStatusMap[fn] ? `Ciclo ${cycleStatusMap[fn].numero} · ${target ? `${pct}% del límite de ${target} preguntas` : 'sin límite de preguntas'}` : 'Sin ciclo iniciado'}</p>
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
        <p className="text-xs font-semibold">{totalProgress} respuestas en ciclos actuales</p>
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
                      {u.enVacaciones && <Badge className="text-xs bg-sky-100 text-sky-700 border-sky-200">🌴 vacaciones</Badge>}
                      {u.autoaprobarManual && <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">⚡ autoaprobación</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>

                    {/* Supervisor */}
                    <div className="mt-2 flex items-center gap-2" data-tour={u.id === primerOtroUsuarioId ? 'admin-supervisor' : undefined}>
                      <span className="text-xs text-muted-foreground shrink-0">Supervisor:</span>
                      <select
                        value={u.autoaprobarManual ? '__auto__' : (u.supervisorId || '')}
                        onChange={e => changeSupervisor(u, e.target.value)}
                        className="text-xs border rounded px-2 py-0.5 bg-background flex-1 min-w-0"
                      >
                        <option value="">Sin supervisor</option>
                        <option value="__auto__">Autoaprobación (sin revisor)</option>
                        {users
                          .filter(s => s.activo && ['admin', 'superadmin'].includes(s.rol) && s.id !== u.id)
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.nombre} ({s.rol})</option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Function toggles */}
                    <div className="flex flex-wrap gap-1.5 mt-2" data-tour={u.id === primerOtroUsuarioId ? 'admin-funciones' : undefined}>
                      {funciones.map(fn => {
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
                  <div className="flex items-center gap-1 shrink-0" data-tour={u.id === primerOtroUsuarioId ? 'admin-acciones' : undefined}>
                    {u.id !== user?.id && (
                      <>
                        <button
                          onClick={() => toggleVacaciones(u)}
                          title={u.enVacaciones ? 'Quitar vacaciones' : 'Marcar en vacaciones'}
                          className={`p-1.5 rounded-lg transition-colors ${u.enVacaciones ? 'text-sky-500 hover:text-sky-700 bg-sky-50 hover:bg-sky-100' : 'text-muted-foreground hover:text-sky-600 hover:bg-muted'}`}
                        >
                          <Palmtree size={15} />
                        </button>
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
      <div className="mt-6 border rounded-xl overflow-hidden" data-tour="admin-bugs">
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
                {funciones.map(fn => (
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

      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Catálogo de puestos</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={newFunctionName} onChange={event => setNewFunctionName(event.target.value)} placeholder="Nombre del nuevo puesto" onKeyDown={event => event.key === 'Enter' && createFunction()} />
            <Button onClick={createFunction} disabled={!newFunctionName.trim()}>Agregar</Button>
          </div>
          <div className="max-h-80 overflow-auto space-y-2">
            {functionCatalog.map(entry => <div key={entry.nombre} className={`flex items-center gap-2 rounded-lg border p-2 ${entry.activo ? '' : 'opacity-50'}`}>
              <span className="flex-1 text-sm">{FUNC_ICONS[entry.nombre]} {entry.nombre}</span>
              <Button variant="ghost" size="sm" onClick={() => renameFunction(entry)}>Renombrar</Button>
              <Button variant="outline" size="sm" onClick={() => toggleCatalogFunction(entry)}>{entry.activo ? 'Desactivar' : 'Reactivar'}</Button>
            </div>)}
          </div>
          <p className="text-xs text-muted-foreground">Desactivar oculta el puesto para nuevas asignaciones, pero conserva usuarios, ciclos, manuales e historial.</p>
          <DialogFooter><Button variant="outline" onClick={() => setShowCatalog(false)}>Cerrar</Button></DialogFooter>
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
