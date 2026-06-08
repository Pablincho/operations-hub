import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Asistente from '@/pages/Asistente'
import MiArea from '@/pages/MiArea'
import Checkin from '@/pages/Checkin'
import Admin from '@/pages/Admin'
import Revisiones from '@/pages/Revisiones'

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
      <Route path="/mi-area" element={<ProtectedRoute><MiArea /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute><Checkin /></ProtectedRoute>} />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
