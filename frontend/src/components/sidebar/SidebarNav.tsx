import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { MenuItem } from './menuConfig'

type SidebarNavProps = {
  items: MenuItem[]
  compact: boolean
  onNavigate?: () => void
}

function pathMatches(item: MenuItem, pathname: string): boolean {
  if (item.to) {
    if (item.end) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }
  return Boolean(item.children?.some((child) => pathMatches(child, pathname)))
}

function NavBranch({
  items,
  depth,
  compact,
  onNavigate,
  openIds,
  toggleOpen,
}: {
  items: MenuItem[]
  depth: number
  compact: boolean
  onNavigate?: () => void
  openIds: Set<string>
  toggleOpen: (id: string) => void
}) {
  const location = useLocation()

  return (
    <ul className={`nav-tree${depth > 0 ? ' nav-tree-nested' : ''}`} style={{ ['--nav-depth' as string]: depth }}>
      {items.map((item) => {
        const Icon = item.icon
        const hasChildren = Boolean(item.children?.length)
        const isOpen = openIds.has(item.id) || pathMatches(item, location.pathname)
        const activeBranch = pathMatches(item, location.pathname)

        if (hasChildren && item.children) {
          return (
            <li key={item.id} className="nav-item">
              <button
                type="button"
                className={`nav-link nav-group-trigger${activeBranch ? ' active' : ''}`}
                onClick={() => toggleOpen(item.id)}
                title={item.label}
                aria-expanded={isOpen}
              >
                {Icon ? (
                  <span className="nav-icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                ) : null}
                <span className="nav-label">{item.label}</span>
                {!compact ? (
                  <ChevronDown
                    size={16}
                    strokeWidth={1.8}
                    className={`nav-chevron${isOpen ? ' is-open' : ''}`}
                    aria-hidden
                  />
                ) : null}
              </button>
              {isOpen && !compact ? (
                <NavBranch
                  items={item.children}
                  depth={depth + 1}
                  compact={compact}
                  onNavigate={onNavigate}
                  openIds={openIds}
                  toggleOpen={toggleOpen}
                />
              ) : null}
            </li>
          )
        }

        if (!item.to) return null

        return (
          <li key={item.id} className="nav-item">
            <NavLink
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={onNavigate}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {Icon ? (
                <span className="nav-icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
              ) : null}
              <span className="nav-label">{item.label}</span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

export function SidebarNav({ items, compact, onNavigate }: SidebarNavProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(items.filter((i) => i.children?.length).map((i) => i.id)))

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <NavBranch
        items={items}
        depth={0}
        compact={compact}
        onNavigate={onNavigate}
        openIds={openIds}
        toggleOpen={toggleOpen}
      />
    </nav>
  )
}
