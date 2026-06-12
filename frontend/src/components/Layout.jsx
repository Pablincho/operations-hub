import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { Bot, BookText, LayoutDashboard, Settings, LogOut, ClipboardCheck } from 'lucide-react'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { tieneCheckin, tieneRevisiones } = useNotifications()
  const navigate = useNavigate()
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

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: '#e8d5a3' }}
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

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
