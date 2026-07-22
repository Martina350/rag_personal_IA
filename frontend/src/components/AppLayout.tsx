import { useEffect, useState, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logo from '../assets/ai_talent_logo.png'
import { menuForUser } from './sidebar/menuConfig'
import { SidebarNav } from './sidebar/SidebarNav'

function userInitials(username?: string) {
  if (!username) return 'U'
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Desktop: rail colapsado (80px). En hover se expande visualmente a 280px.
  const isCollapsed = true
  const visuallyExpanded = !isCollapsed || hovered || menuOpen
  const compact = isCollapsed && !visuallyExpanded

  useEffect(() => {
    setMenuOpen(false)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const sidebarClass = [
    'sidebar',
    isCollapsed ? 'sidebar-collapsed' : '',
    visuallyExpanded ? 'sidebar-expanded' : '',
    menuOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="app-shell app-shell-collapsed">
      <div className="sidebar-slot sidebar-slot-collapsed">
        <aside
          className={sidebarClass}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="sidebar-brand">
            <img src={logo} alt="AI Talent" className="sidebar-logo" />
            <span className="sidebar-brand-text">AI Talent Workspace</span>
          </div>

          <SidebarNav
            items={menuForUser(Boolean(user?.is_admin))}
            compact={compact}
            onNavigate={() => setMenuOpen(false)}
          />

          <div className="sidebar-footer">
            <div
              className="sidebar-user-card"
              title={`${user?.username ?? ''} · ${user?.role_label ?? ''}`}
            >
              <div className="sidebar-avatar" aria-hidden="true">
                {userInitials(user?.username)}
              </div>
              <div className="sidebar-user-meta">
                <strong className="sidebar-user-name">{user?.username}</strong>
                <span className="sidebar-user-role">{user?.role_label}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-logout btn-block"
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              <LogOut size={18} strokeWidth={1.8} />
              <span className="nav-label">Cerrar sesión</span>
            </button>
          </div>
        </aside>
      </div>

      {menuOpen ? (
        <button type="button" className="overlay-sidebar" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
      ) : null}

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
