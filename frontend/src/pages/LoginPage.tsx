import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type FieldErrors = {
  username?: string
  password?: string
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9.3 3.1 11 7-.4 1-1 2-1.7 2.9M6.1 6.1C4.1 7.4 2.6 9.3 2 12c1.7 3.9 6 7 10 7 1.4 0 2.7-.3 3.9-.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function validateLogin(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  const trimmedUsername = username.trim()

  if (!trimmedUsername) {
    errors.username = 'El usuario es obligatorio.'
  }

  if (!password) {
    errors.password = 'La contraseña es obligatoria.'
  } else if (password.length < 4) {
    errors.password = 'La contraseña debe tener al menos 4 caracteres.'
  }

  return errors
}

export function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (token) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const nextErrors = validateLogin(username, password)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      await login(username.trim(), password)
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
        <h1>Analiza curriculums y certificaciones con control de acceso</h1>
        <p style={{ opacity: 0.92, maxWidth: 420 }}>
          La información se entrega según tu rol autorizado. Los datos sensibles permanecen protegidos.
        </p>
      </section>

      <section className="login-panel">
        <form className="card" onSubmit={onSubmit} noValidate>
          <h2>Iniciar sesión</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Ingresa con tu usuario autorizado.
          </p>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className={`field${fieldErrors.username ? ' has-error' : ''}`}>
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              onChange={(e) => {
                setUsername(e.target.value)
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }))
                }
              }}
            />
            {fieldErrors.username ? (
              <p id="username-error" className="field-error" role="alert">
                {fieldErrors.username}
              </p>
            ) : null}
          </div>

          <div className={`field${fieldErrors.password ? ' has-error' : ''}`}>
            <label htmlFor="password">Contraseña</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  }
                }}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="password-error" className="field-error" role="alert">
                {fieldErrors.password}
              </p>
            ) : null}
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
