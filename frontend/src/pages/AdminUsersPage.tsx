import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
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

function RoleSelect({
  id,
  roles,
  value,
  onChange,
}: {
  id: string
  roles: AdminRole[]
  value: string
  onChange: (roleName: string) => void
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
    <div className="custom-select" ref={rootRef}>
      <button
        id={id}
        type="button"
        className={`custom-select-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
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

export function AdminUsersPage() {
  const { token, user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [roleName, setRoleName] = useState('general')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const selectedRole = useMemo(
    () => roles.find((role) => role.name === roleName) ?? null,
    [roles, roleName],
  )

  const inspectedUser = useMemo(
    () => users.find((item) => item.username === selectedUser) ?? null,
    [users, selectedUser],
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

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const created = await createAdminUser(token, {
        username: username.trim(),
        password,
        role_name: roleName,
      })
      setSuccess(`Usuario '${created.username}' creado con rol ${created.role_label}.`)
      setUsername('')
      setPassword('')
      setSelectedUser(created.username)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onRevoke(target: string) {
    if (!token) return
    if (!window.confirm(`¿Revocar el acceso de '${target}'?`)) return
    setError(null)
    setSuccess(null)
    try {
      const result = await revokeAdminUser(token, target)
      setSuccess(result.message)
      if (selectedUser === target) setSelectedUser(null)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revocar el usuario.')
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

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="admin-grid">
        <section className="card admin-card">
          <h2>Usuarios registrados</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Incluye los creados por CLI y por esta pantalla.
          </p>
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
                  className={`admin-user-row${selectedUser === item.username ? ' active' : ''}${item.is_active ? '' : ' revoked'}`}
                >
                  <button
                    type="button"
                    className="admin-user-select"
                    onClick={() => setSelectedUser(item.username)}
                  >
                    <strong>{item.username}</strong>
                    <span>
                      {item.role_label}
                      {!item.is_active ? ' · revocado' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ minHeight: 36 }}
                    disabled={!item.is_active || item.username === user.username}
                    onClick={() => void onRevoke(item.username)}
                  >
                    Revocar
                  </button>
                </div>
              ))}
            </div>
          )}

          {inspectedUser ? (
            <div className="admin-inspect">
              <h3>Permisos de {inspectedUser.username}</h3>
              <p className="muted">
                Rol: {inspectedUser.role_label} ({inspectedUser.role_name})
              </p>
              <PermissionsTable permissions={inspectedUser.permissions} />
            </div>
          ) : null}
        </section>

        <section className="card admin-card">
          <h2>Crear usuario</h2>
          <form className="admin-form" onSubmit={onCreate}>
            <div className="field">
              <label htmlFor="admin-username">Usuario</label>
              <input
                id="admin-username"
                value={username}
                autoComplete="off"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="admin-password">Contraseña</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                autoComplete="new-password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="muted" style={{ fontSize: '0.8125rem' }}>
                Mínimo 8 caracteres. Se guarda con Argon2 (nunca en texto plano).
              </p>
            </div>
            <div className="field">
              <label htmlFor="admin-role">Rol</label>
              <RoleSelect
                id="admin-role"
                roles={roles}
                value={roleName}
                onChange={setRoleName}
              />
            </div>

            {selectedRole ? (
              <div className="admin-role-preview">
                <h3>Permisos del rol seleccionado</h3>
                <p className="muted" style={{ marginBottom: 8 }}>
                  Al crear el usuario heredará esta autorización. El tono por defecto del rol es{' '}
                  <strong>{selectedRole.tone_key}</strong>.
                </p>
                <PermissionsTable permissions={selectedRole.permissions} />
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear usuario'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
