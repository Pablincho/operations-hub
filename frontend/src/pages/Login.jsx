import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password })
      login(res.data.data.token, res.data.data.usuario)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{ background: '#f5f5f0' }}
    >
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-xl font-bold" style={{ color: '#1a3a1a' }}>Don Emilio</h1>
          <p className="text-sm text-muted-foreground mt-1">Administración Operativa</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-10 font-semibold"
            style={{ background: '#1a3a1a', color: '#e8d5a3' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
