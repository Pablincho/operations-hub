import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check } from 'lucide-react'

function PasswordRequirements({ password }) {
  const checks = [
    { label: '8 caracteres mínimo', ok: password.length >= 8 },
    { label: '1 mayúscula', ok: /[A-Z]/.test(password) },
    { label: '1 minúscula', ok: /[a-z]/.test(password) },
    { label: '1 número', ok: /[0-9]/.test(password) },
  ]
  return (
    <ul className="flex flex-col gap-1 px-1">
      {checks.map(({ label, ok }) => (
        <li
          key={label}
          className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-600' : 'text-muted-foreground'}`}
        >
          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${ok ? 'bg-green-500' : 'bg-gray-200'}`}>
            {ok && <Check size={10} strokeWidth={3} className="text-white" />}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password = '') {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos 1 mayúscula'
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos 1 minúscula'
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos 1 número'
  return ''
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setError('Ingresá un email válido')
      return
    }
    if (!password.trim()) {
      setError('Ingresá tu contraseña')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email: normalizedEmail, password })

      if (res.data.data?.requiresPasswordSetup) {
        setSetupToken(res.data.data.setupToken)
        setMode('firstPassword')
        setInfo('Primer ingreso detectado. Definí tu contraseña definitiva.')
        setPassword('')
        return
      }

      login(res.data.data.token, res.data.data.usuario)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function handleFirstPassword(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    const pwError = validatePassword(newPassword)
    if (pwError) {
      setError(pwError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/first-password', { setupToken, password: newPassword })
      login(res.data.data.token, res.data.data.usuario)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecoveryRequest(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setError('Ingresá un email válido')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/recover/request', { email: normalizedEmail })
      setMode('recoverReset')
      setEmail(normalizedEmail)
      const code = res.data?.data?.recoveryCode
      setInfo(code
        ? `Código generado (modo desarrollo): ${code}`
        : 'Si el email existe, se generó un código de recuperación.')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar la recuperación')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecoveryReset(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    const pwError = validatePassword(newPassword)
    if (pwError) {
      setError(pwError)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!recoveryCode.trim()) {
      setError('Ingresá el código de recuperación')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/recover/reset', {
        email: email.trim().toLowerCase(),
        code: recoveryCode.trim(),
        password: newPassword
      })
      setMode('login')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setRecoveryCode('')
      setInfo('Contraseña actualizada. Ya podés iniciar sesión.')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo recuperar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  function resetToLogin() {
    setMode('login')
    setError('')
    setInfo('')
    setSetupToken('')
    setNewPassword('')
    setConfirmPassword('')
    setRecoveryCode('')
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{ background: '#f5f5f0' }}
    >
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="https://res.cloudinary.com/dmigevwah/image/upload/v1777495745/don_emilio/don_emilio_logo.svg"
            alt="Don Emilio"
            className="h-14 w-auto mx-auto mb-3 object-contain"
          />
          <p className="text-sm text-muted-foreground mt-1">Administración Operativa</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setInfo('') }}
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); setInfo('') }}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => { setMode('recoverRequest'); setError(''); setInfo('') }}
              className="text-xs text-left text-muted-foreground hover:text-foreground underline"
            >
              Olvidé mi contraseña
            </button>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {info && <p className="text-green-700 text-sm text-center">{info}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 font-semibold"
              style={{ background: '#1a3a1a', color: '#e8d5a3' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        )}

        {mode === 'firstPassword' && (
          <form onSubmit={handleFirstPassword} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Definí una contraseña definitiva para tu cuenta.
            </p>
            <Input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError(''); setInfo('') }}
              autoComplete="new-password"
              required
            />
            <PasswordRequirements password={newPassword} />
            <Input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); setInfo('') }}
              autoComplete="new-password"
              required
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {info && <p className="text-green-700 text-sm text-center">{info}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 font-semibold"
              style={{ background: '#1a3a1a', color: '#e8d5a3' }}
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        {mode === 'recoverRequest' && (
          <form onSubmit={handleRecoveryRequest} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Ingresá tu email para generar un código de recuperación (válido por 15 minutos).
            </p>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setInfo('') }}
              autoComplete="email"
              required
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {info && <p className="text-green-700 text-sm text-center">{info}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 font-semibold"
              style={{ background: '#1a3a1a', color: '#e8d5a3' }}
            >
              {loading ? 'Generando...' : 'Generar código'}
            </Button>
            <Button type="button" variant="outline" onClick={resetToLogin}>Volver al login</Button>
          </form>
        )}

        {mode === 'recoverReset' && (
          <form onSubmit={handleRecoveryReset} className="flex flex-col gap-3">
            <Input type="email" value={email} disabled />
            <Input
              type="text"
              placeholder="Código de recuperación"
              value={recoveryCode}
              onChange={e => { setRecoveryCode(e.target.value); setError(''); setInfo('') }}
              required
            />
            <Input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError(''); setInfo('') }}
              autoComplete="new-password"
              required
            />
            <PasswordRequirements password={newPassword} />
            <Input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); setInfo('') }}
              autoComplete="new-password"
              required
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            {info && <p className="text-green-700 text-sm text-center">{info}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 font-semibold"
              style={{ background: '#1a3a1a', color: '#e8d5a3' }}
            >
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
            <Button type="button" variant="outline" onClick={resetToLogin}>Volver al login</Button>
          </form>
        )}
      </div>
    </div>
  )
}
