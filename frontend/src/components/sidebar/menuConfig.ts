import type { LucideIcon } from 'lucide-react'
import { Home, MessageSquareText, Users } from 'lucide-react'

export type MenuItem = {
  id: string
  label: string
  icon?: LucideIcon
  to?: string
  end?: boolean
  children?: MenuItem[]
  adminOnly?: boolean
}

export const SIDEBAR_MENU: MenuItem[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: Home,
    to: '/',
    end: true,
  },
  {
    id: 'consultas',
    label: 'Consultas',
    icon: MessageSquareText,
    to: '/consultar',
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    icon: Users,
    to: '/usuarios',
    adminOnly: true,
  },
]

export function menuForUser(isAdmin: boolean): MenuItem[] {
  return SIDEBAR_MENU.filter((item) => !item.adminOnly || isAdmin)
}
