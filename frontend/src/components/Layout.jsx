import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Bot, BookOpen, CalendarCheck, LayoutDashboard, Settings, LogOut } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/asistente', label: 'Asistente', icon: Bot },
  { to: '/mi-area', label: 'Mi Área', icon: BookOpen },
  { to: '/checkin', label: 'Check-in', icon: CalendarCheck }
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isAdmin = ['admin', 'superadmin'].includes(user?.rol)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header style={{ background: '#1a3a1a' }} className="flex items-center gap-3 px-5 py-3 shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ background: '#e8d5a3' }}
        >
          🌾
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: '#e8d5a3' }}>
            Don Emilio – Admin Operativa
          </p>
          <p className="text-xs opacity-60" style={{ color: '#e8d5a3' }}>
            {user?.nombre} · {user?.rol}
          </p>
        </div>

        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: '#e8d5a3'
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin">
              {({ isActive }) => (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: '#e8d5a3'
                  }}
                >
                  <Settings size={14} />
                  Admin
                </button>
              )}
            </NavLink>
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
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <button
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap"
                style={{
                  background: isActive ? '#f0f7f0' : 'transparent',
                  color: isActive ? '#1a3a1a' : '#666',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin">
            {({ isActive }) => (
              <button
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
                style={{
                  background: isActive ? '#f0f7f0' : 'transparent',
                  color: isActive ? '#1a3a1a' : '#666',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                <Settings size={16} />
                Admin
              </button>
            )}
          </NavLink>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
