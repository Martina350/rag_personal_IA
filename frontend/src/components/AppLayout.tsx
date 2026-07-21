import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const nav = (
    <>
      <div className="sidebar-brand">AI Talent Workspace</div>
      <nav>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
          Inicio
        </NavLink>
        <NavLink to="/consultar" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
          Consultar
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? ' mobile-open' : ''}`}>{nav}</aside>
      {menuOpen ? <button type="button" className="overlay-sidebar" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /> : null}

      <div className="main">
        <div className="mobile-bar">
          <button type="button" className="btn btn-ghost" onClick={() => setMenuOpen(true)}>
            Menú
          </button>
          <span className="badge">Rol: {user?.role_label}</span>
        </div>

        <header className="topbar">
          <p className="muted" style={{ margin: 0 }}>
            Consulta segura sobre documentos autorizados
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="badge">Rol activo: {user?.role_label}</span>
            <strong>{user?.username}</strong>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, loading, refreshMe, clearSession } = useAuth()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) {
        navigate('/login', { replace: true })
        return
      }
      if (!user) {
        try {
          await refreshMe()
        } catch {
          clearSession()
          navigate('/login', { replace: true })
          return
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [token, user, refreshMe, clearSession, navigate])

  if (loading || !ready || !user) {
    return (
      <div className="content">
        <div className="card">
          <div className="skeleton">
            <div className="skeleton-line" style={{ width: '40%' }} />
            <div className="skeleton-line" style={{ width: '100%' }} />
            <div className="skeleton-line" style={{ width: '70%' }} />
          </div>
        </div>
      </div>
    )
  }

  return children
}
