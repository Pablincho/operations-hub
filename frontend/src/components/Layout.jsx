import { useState, useRef, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { Bot, BookText, LayoutDashboard, Settings, LogOut, ClipboardCheck, Bug, Lightbulb, X, ImagePlus, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import api from '@/services/api'

function BugReportDialog({ open, onClose, pagina }) {
  const [tipo, setTipo] = useState('bug')
  const [texto, setTexto] = useState('')
  const [imagen, setImagen] = useState(null) // base64 data URL
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef()

  function reset() {
    setTipo('bug')
    setTexto('')
    setImagen(null)
    setSending(false)
    setDone(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function readFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 4 * 1024 * 1024) {
      alert('La imagen no puede superar 4 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = e => setImagen(e.target.result)
    reader.readAsDataURL(file)
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        readFile(item.getAsFile())
        break
      }
    }
  }

  async function submit() {
    if (!texto.trim()) return
    setSending(true)
    try {
      await api.post('/bugs', { texto: texto.trim(), pagina, imagen, tipo })
      setDone(true)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar el reporte')
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent onPaste={handlePaste} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === 'bug'
              ? <Bug size={16} className="text-amber-600" />
              : <Lightbulb size={16} className="text-blue-500" />}
            {tipo === 'bug' ? 'Reportar un problema' : 'Proponer una mejora'}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-700">{tipo === 'bug' ? '¡Reporte enviado!' : '¡Sugerencia enviada!'}</p>
            <p className="text-xs text-muted-foreground mt-1">Gracias. Lo revisaremos pronto.</p>
            <Button className="mt-4" onClick={handleClose} style={{ background: '#1a3a1a', color: '#e8d5a3' }}>Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {[
                  { value: 'bug', label: 'Problema', icon: Bug },
                  { value: 'mejora', label: 'Mejora', icon: Lightbulb }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors"
                    style={tipo === value
                      ? { background: '#1a3a1a', color: '#e8d5a3', borderColor: '#1a3a1a' }
                      : { background: 'transparent', color: '#666', borderColor: '#ddd' }}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Página</label>
                <p className="text-xs text-foreground bg-muted rounded px-2 py-1 font-mono">{pagina}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {tipo === 'bug' ? 'Descripción del problema *' : 'Descripción de la mejora *'}
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1a3a1a]"
                  rows={4}
                  placeholder={tipo === 'bug'
                    ? 'Describí qué pasó y cómo reproducirlo...'
                    : 'Describí qué mejorarías y por qué sería útil...'}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Captura de pantalla (opcional)</label>
                {imagen ? (
                  <div className="relative">
                    <img src={imagen} alt="preview" className="w-full rounded-lg border max-h-48 object-contain bg-muted" />
                    <button
                      onClick={() => setImagen(null)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border border-dashed rounded-lg py-4 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors flex flex-col items-center gap-1.5"
                  >
                    <ImagePlus size={18} />
                    Seleccioná un archivo o pegá una captura (Ctrl+V)
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => readFile(e.target.files?.[0])} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={submit}
                disabled={!texto.trim() || sending}
                style={{ background: '#1a3a1a', color: '#e8d5a3' }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : tipo === 'bug' ? 'Enviar reporte' : 'Enviar sugerencia'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { tieneCheckin, tieneRevisiones } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()
  const [showBugReport, setShowBugReport] = useState(false)
  const headerLogoUrl = 'https://res.cloudinary.com/dmigevwah/image/upload/v1777497691/don_emilio/don_emilio_logo_header.svg'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header style={{ background: '#1a3a1a' }} className="flex items-center gap-3 px-5 py-3 shrink-0">
        <img
          src={headerLogoUrl}
          alt="Don Emilio"
          className="h-9 w-auto shrink-0 object-contain"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: '#e8d5a3' }}>
            Administración
          </p>
          <p className="text-xs opacity-60" style={{ color: '#e8d5a3' }}>
            {user?.nombre} · {user?.rol}
          </p>
        </div>

        <nav className="hidden sm:flex items-center gap-1">
          {[
            { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard, dot: false },
            { to: '/manual', label: 'Mi Manual', icon: BookText, dot: tieneCheckin },
            { to: '/asistente', label: 'Asistente', icon: Bot, dot: false },
          ].map(({ to, label, icon: Icon, dot }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#e8d5a3' }}>
                  <span className="relative">
                    <Icon size={14} />
                    {dot && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#1a3a1a]" />}
                  </span>
                  {label}
                </button>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <NavLink to="/revisiones">
                {({ isActive }) => (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#e8d5a3' }}>
                    <span className="relative">
                      <ClipboardCheck size={14} />
                      {tieneRevisiones && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#1a3a1a]" />}
                    </span>
                    Revisiones
                  </button>
                )}
              </NavLink>
              <NavLink to="/admin">
                {({ isActive }) => (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#e8d5a3' }}>
                    <Settings size={14} />
                    Admin
                  </button>
                )}
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center border-l border-white/20 pl-2">
          <button
            onClick={() => setShowBugReport(true)}
            title="Reportar problema o sugerir mejora"
            className="flex items-center p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: '#e8d5a3' }}
          >
            <Bug size={14} />
          </button>
          <button
            onClick={handleLogout}
            title="Salir"
            className="flex items-center p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: '#e8d5a3' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <BugReportDialog
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
        pagina={location.pathname}
      />

      {/* Mobile nav */}
      <nav className="sm:hidden flex gap-1 px-3 py-2 border-b bg-white overflow-x-auto shrink-0">
        {[
          { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard, dot: false },
          { to: '/manual', label: 'Mi Manual', icon: BookText, dot: tieneCheckin },
          { to: '/asistente', label: 'Asistente', icon: Bot, dot: false },
        ].map(({ to, label, icon: Icon, dot }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap"
                style={{ background: isActive ? '#f0f7f0' : 'transparent', color: isActive ? '#1a3a1a' : '#666', fontWeight: isActive ? 600 : 400 }}>
                <span className="relative">
                  <Icon size={16} />
                  {dot && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" />}
                </span>
                {label}
              </button>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            <NavLink to="/revisiones">
              {({ isActive }) => (
                <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
                  style={{ background: isActive ? '#f0f7f0' : 'transparent', color: isActive ? '#1a3a1a' : '#666', fontWeight: isActive ? 600 : 400 }}>
                  <span className="relative">
                    <ClipboardCheck size={16} />
                    {tieneRevisiones && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" />}
                  </span>
                  Revisiones
                </button>
              )}
            </NavLink>
            <NavLink to="/admin">
              {({ isActive }) => (
                <button className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
                  style={{ background: isActive ? '#f0f7f0' : 'transparent', color: isActive ? '#1a3a1a' : '#666', fontWeight: isActive ? 600 : 400 }}>
                  <Settings size={16} />
                  Admin
                </button>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
