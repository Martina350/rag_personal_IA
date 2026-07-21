import type { LucideIcon } from 'lucide-react'
import { Home, MessageSquareText } from 'lucide-react'

export type MenuItem = {
  id: string
  label: string
  icon?: LucideIcon
  to?: string
  end?: boolean
  children?: MenuItem[]
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
]
