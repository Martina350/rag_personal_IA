import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronDown, Eye, Plus, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { ApiError, createAdminUser, fetchAdminRoles, fetchAdminUsers, revokeAdminUser } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { AdminRole, AdminUser, Permissions } from '../types'

const RESOURCE_LABELS: Record<keyof Permissions, string> = {
  profile: 'Perfil / CV',
  certifications: 'Certificaciones',
  projects: 'Proyectos',
  sensitive: 'Datos sensibles',
}

function levelClass(level: string) {
  if (level === 'full') return 'perm-full'
  if (level === 'partial') return 'perm-partial'
  return 'perm-none'
}

function PermissionsTable({ permissions }: { permissions: Permissions }) {
  return (
    <table className="perm-table">
      <thead>
        <tr>
          <th>Recurso</th>
          <th>Nivel</th>
        </tr>
      </thead>
      <tbody>
        {(Object.keys(RESOURCE_LABELS) as (keyof Permissions)[]).map((key) => (
          <tr key={key}>
            <td>{RESOURCE_LABELS[key]}</td>
            <td>
              <span className={`perm-badge ${levelClass(permissions[key])}`}>{permissions[key]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`admin-modal${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div>
            <h2 id="admin-modal-title">{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="chat-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer ? <div className="admin-modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}

function RoleSelect({
  id,
  roles,
  value,
  onChange,
  hasError,
}: {
  id: string
  roles: AdminRole[]
  value: string
  onChange: (roleName: string) => void
  hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = roles.find((role) => role.name === value)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  return (
    <div className={`custom-select${hasError ? ' has-error' : ''}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className={`custom-select-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={hasError}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? 'Selecciona un rol'}</span>
        <span className="custom-select-caret" aria-hidden>
          <ChevronDown size={18} strokeWidth={1.8} />
        </span>
      </button>

      {open ? (
        <ul className="custom-select-menu" role="listbox" aria-labelledby={id}>
          {roles.map((role) => (
            <li key={role.name}>
              <button
                type="button"
                role="option"
                aria-selected={role.name === value}
                className={`custom-select-option${role.name === value ? ' active' : ''}`}
                onClick={() => {
                  onChange(role.name)
                  setOpen(false)
                }}
              >
                {role.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

type CreateFieldErrors = {
  username?: string
  password?: string
  confirmPassword?: string
  roleName?: string
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/

function validateCreateUser(input: {
  username: string
  password: string
  confirmPassword: string
  roleName: string
  existingUsernames: string[]
  roleNames: string[]
}): CreateFieldErrors {
  const errors: CreateFieldErrors = {}
  const trimmed = input.username.trim()

  if (!trimmed) {
    errors.username = 'El usuario es obligatorio.'
  } else if (trimmed.length < 3) {
    errors.username = 'El usuario debe tener al menos 3 caracteres.'
  } else if (!USERNAME_PATTERN.test(trimmed)) {
    errors.username = 'Usa solo letras, números, punto, guion o guion bajo (3–64).'
  } else if (input.existingUsernames.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
    errors.username = 'Ese usuario ya existe.'
  }

  if (!input.password) {
    errors.password = 'La contraseña es obligatoria.'
  } else if (input.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  } else if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
    errors.password = 'Incluye al menos una letra y un número.'
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Confirma la contraseña.'
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.'
  }

  if (!input.roleName) {
    errors.roleName = 'Selecciona un rol.'
  } else if (!input.roleNames.includes(input.roleName)) {
    errors.roleName = 'El rol seleccionado no es válido.'
  }

  return errors
}

export function AdminUsersPage() {
  const { token, user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [permissionsUser, setPermissionsUser] = useState<AdminUser | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<CreateFieldErrors>({})

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [roleName, setRoleName] = useState('general')

  const selectedRole = useMemo(
    () => roles.find((role) => role.name === roleName) ?? null,
    [roles, roleName],
  )

  async function loadData() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        fetchAdminUsers(token),
        fetchAdminRoles(token),
      ])
      setUsers(nextUsers)
      setRoles(nextRoles)
      if (nextRoles.length && !nextRoles.some((role) => role.name === roleName)) {
        setRoleName(nextRoles[0].name)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la administración.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [token])

  if (!user?.is_admin) {
    return <Navigate to="/" replace />
  }

  function resetCreateForm() {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setRoleName(roles[0]?.name ?? 'general')
    setFieldErrors({})
  }

  function openCreateModal() {
    setError(null)
    resetCreateForm()
    setCreateOpen(true)
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setSuccess(null)

    const nextErrors = validateCreateUser({
      username,
      password,
      confirmPassword,
      roleName,
      existingUsernames: users.map((item) => item.username),
      roleNames: roles.map((role) => role.name),
    })
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      const created = await createAdminUser(token, {
        username: username.trim(),
        password,
        role_name: roleName,
      })
      setSuccess(`Usuario '${created.username}' creado con rol ${created.role_label}.`)
      setCreateOpen(false)
      resetCreateForm()
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmRevoke() {
    if (!token || !revokeTarget) return
    const target = revokeTarget
    setError(null)
    setSuccess(null)
    setRevoking(true)
    try {
      const result = await revokeAdminUser(token, target)
      setSuccess(result.message)
      if (permissionsUser?.username === target) setPermissionsUser(null)
      setRevokeTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revocar el usuario.')
      setRevokeTarget(null)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Gestión de usuarios</h1>
          <p className="muted">
            Solo administrador. Aquí verificas autenticación (quién entra), autorización (rol y
            permisos) y el alta con contraseña hasheada en el servidor (Argon2).
          </p>
        </div>
      </header>

      {error && !createOpen ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="card admin-card admin-card-full">
        <div className="admin-section-head">
          <div>
            <h2>Usuarios registrados</h2>
            <p className="muted">Incluye los creados por CLI y por esta pantalla.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} strokeWidth={1.8} />
            Crear nuevo usuario
          </button>
        </div>

        {loading ? (
          <div className="skeleton">
            <div className="skeleton-line" style={{ width: '80%' }} />
            <div className="skeleton-line" style={{ width: '100%' }} />
          </div>
        ) : users.length === 0 ? (
          <p className="empty">No hay usuarios.</p>
        ) : (
          <div className="admin-user-list">
            {users.map((item) => (
              <div
                key={item.id}
                className={`admin-user-row${item.is_active ? '' : ' revoked'}`}
              >
                <div className="admin-user-info">
                  <strong>{item.username}</strong>
                  <span>
                    {item.role_label}
                    {!item.is_active ? ' · revocado' : ''}
                  </span>
                </div>
                <div className="admin-user-actions">
                  <button
                    type="button"
                    className="chat-icon-btn"
                    title="Ver permisos"
                    aria-label={`Ver permisos de ${item.username}`}
                    onClick={() => setPermissionsUser(item)}
                  >
                    <Eye size={18} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ minHeight: 40 }}
                    disabled={!item.is_active || item.username === user.username}
                    onClick={() => setRevokeTarget(item.username)}
                  >
                    Revocar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {permissionsUser ? (
        <Modal
          title={`Permisos de ${permissionsUser.username}`}
          subtitle={`Rol: ${permissionsUser.role_label} (${permissionsUser.role_name})`}
          onClose={() => setPermissionsUser(null)}
        >
          <PermissionsTable permissions={permissionsUser.permissions} />
          <p className="muted" style={{ marginTop: 14, fontSize: '0.8125rem' }}>
            Estos niveles definen qué documentos puede consultar en el chat. El tono conversacional
            es independiente.
          </p>
        </Modal>
      ) : null}

      {revokeTarget ? (
        <Modal
          title="Revocar acceso"
          subtitle="Esta acción desactiva el usuario de inmediato."
          onClose={() => {
            if (!revoking) setRevokeTarget(null)
          }}
          footer={
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={revoking}
                onClick={() => void confirmRevoke()}
              >
                {revoking ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          }
        >
          <p className="admin-confirm-text">
            ¿Revocar el acceso de <strong>{revokeTarget}</strong>? Ya no podrá iniciar sesión ni
            consultar el chat.
          </p>
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal
          title="Crear nuevo usuario"
          subtitle="Asigna un rol para definir la autorización. La contraseña se guarda con Argon2."
          onClose={() => {
            setCreateOpen(false)
            setError(null)
            setFieldErrors({})
          }}
          wide
          footer={
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setCreateOpen(false)
                  setError(null)
                  setFieldErrors({})
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="admin-create-user-form"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          }
        >
          {error ? <div className="alert alert-error">{error}</div> : null}
          <form id="admin-create-user-form" className="admin-form" onSubmit={onCreate} noValidate>
            <div className="admin-form-grid">
              <div className={`field${fieldErrors.username ? ' has-error' : ''}`}>
                <label htmlFor="admin-username">Usuario</label>
                <input
                  id="admin-username"
                  value={username}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? 'admin-username-error' : undefined}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (fieldErrors.username) {
                      setFieldErrors((prev) => ({ ...prev, username: undefined }))
                    }
                  }}
                />
                {fieldErrors.username ? (
                  <p id="admin-username-error" className="field-error" role="alert">
                    {fieldErrors.username}
                  </p>
                ) : null}
              </div>
              <div className={`field${fieldErrors.roleName ? ' has-error' : ''}`}>
                <label htmlFor="admin-role">Rol</label>
                <RoleSelect
                  id="admin-role"
                  roles={roles}
                  value={roleName}
                  hasError={Boolean(fieldErrors.roleName)}
                  onChange={(next) => {
                    setRoleName(next)
                    if (fieldErrors.roleName) {
                      setFieldErrors((prev) => ({ ...prev, roleName: undefined }))
                    }
                  }}
                />
                {fieldErrors.roleName ? (
                  <p id="admin-role-error" className="field-error" role="alert">
                    {fieldErrors.roleName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="admin-form-grid">
              <div className={`field${fieldErrors.password ? ' has-error' : ''}`}>
                <label htmlFor="admin-password">Contraseña</label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                />
                {fieldErrors.password ? (
                  <p id="admin-password-error" className="field-error" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: '0.8125rem' }}>
                    Mínimo 8 caracteres, con letra y número.
                  </p>
                )}
              </div>
              <div className={`field${fieldErrors.confirmPassword ? ' has-error' : ''}`}>
                <label htmlFor="admin-confirm-password">Confirmar contraseña</label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={
                    fieldErrors.confirmPassword ? 'admin-confirm-password-error' : undefined
                  }
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                    }
                  }}
                />
                {fieldErrors.confirmPassword ? (
                  <p id="admin-confirm-password-error" className="field-error" role="alert">
                    {fieldErrors.confirmPassword}
                  </p>
                ) : null}
              </div>
            </div>

            {selectedRole ? (
              <div className="admin-role-preview">
                <h3>Permisos del rol seleccionado</h3>
                <p className="muted" style={{ marginBottom: 8 }}>
                  El usuario heredará esta autorización. Tono por defecto:{' '}
                  <strong>{selectedRole.tone_key}</strong>.
                </p>
                <PermissionsTable permissions={selectedRole.permissions} />
              </div>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
