import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (token) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Las credenciales ingresadas no son válidas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <p style={{ opacity: 0.9, margin: 0 }}>Consulta documental segura</p>
        <h1>Analiza experiencia y certificaciones con control de acceso</h1>
        <p style={{ opacity: 0.92, maxWidth: 420 }}>
          La información se entrega según tu rol autorizado. Los datos sensibles permanecen protegidos.
        </p>
      </section>

      <section className="login-panel">
        <form className="card" onSubmit={onSubmit}>
          <h2>Iniciar sesión</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Ingresa con tu usuario autorizado.
          </p>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start', minHeight: 36, padding: '6px 10px' }}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Validando…' : 'Ingresar'}
          </button>

          <p className="muted" style={{ marginTop: 16, fontSize: '0.8125rem' }}>
            Aviso: no se solicitan ni muestran datos personales sensibles en esta plataforma.
          </p>
        </form>
      </section>
    </div>
  )
}
