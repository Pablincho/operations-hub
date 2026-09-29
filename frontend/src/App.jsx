import { Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import AgentActivityOverlay from '@/components/AgentActivityOverlay'
import api from '@/services/api'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Asistente = lazy(() => import('@/pages/Asistente'))
const MiManual = lazy(() => import('@/pages/Manual'))
const Admin = lazy(() => import('@/pages/Admin'))
const Revisiones = lazy(() => import('@/pages/Revisiones'))

// Atrapa el chunk de una ruta lazy que falla al cargar (típico después de un redeploy,
// cuando el build viejo que tiene el navegador ya no encuentra sus archivos). Sin esto,
// el error pasa de largo Suspense y la app queda en blanco sin ningún mensaje.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    const mensaje = String(error?.message || error)
    // Una descarga de chunk fallida (red inestable o build nuevo) se arregla recargando:
    // lo hacemos solos una vez, y si vuelve a fallar enseguida queda el botón manual.
    const esChunk = /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk|MIME type/i.test(mensaje)
    let recargoReciente = false
    try { recargoReciente = Date.now() - Number(sessionStorage.getItem('remi_chunk_reload') || 0) < 15000 } catch { /* ignore */ }
    if (esChunk && !recargoReciente) {
      try { sessionStorage.setItem('remi_chunk_reload', String(Date.now())) } catch { /* ignore */ }
      window.location.reload()
      return
    }
    // Cualquier otro error quedaba oculto detrás del cartel: lo mandamos a Reportes de
    // bugs para saber qué pasó sin depender de que el usuario lo cuente.
    api.post('/bugs', {
      tipo: 'bug',
      pagina: window.location.pathname,
      texto: `[automático] ${mensaje}\n${navigator.userAgent}\n${info?.componentStack || ''}`.slice(0, 4000)
    }).catch(() => {})
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-medium" style={{ color: '#1a3a1a' }}>No se pudo cargar la página.</p>
            <p className="text-xs text-muted-foreground mt-1">Puede haber una versión nueva disponible.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: '#1a3a1a', color: '#e8d5a3' }}
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requireAdmin && !['admin', 'superadmin'].includes(user.rol)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/asistente" element={<ProtectedRoute><Asistente /></ProtectedRoute>} />
      <Route path="/manual" element={<ProtectedRoute><MiManual /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
      <Route path="/revisiones" element={<ProtectedRoute requireAdmin><Revisiones /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <AgentActivityOverlay />
          <RouteErrorBoundary>
            <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Cargando…</div>}>
              <AppRoutes />
            </Suspense>
          </RouteErrorBoundary>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
