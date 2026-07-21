export type Permissions = {
  profile: string
  certifications: string
  projects: string
  sensitive: string
}

export type UserMe = {
  username: string
  role_name: string
  role_label: string
  tone_key: string
  is_admin: boolean
  permissions: Permissions
}

export type LoginResponse = UserMe & {
  access_token: string
  token_type: string
  expires_in_hours: number
}

export type ChatSource = {
  score: number | null
  file_name: string
  document_type: string
  text: string
}

export type ChatResponse = {
  answer: string
  language: string
  filtered: boolean
  sources: ChatSource[]
}

export type HistoryItem = {
  id: string
  question: string
  answer: string
  toneKey: string
  filtered: boolean
  sources: ChatSource[]
  createdAt: string
}

export type ToneOption = {
  key: string
  label: string
  description: string
}

export const TONE_OPTIONS: ToneOption[] = [
  {
    key: 'reclutador',
    label: 'Reclutador',
    description: 'Tono formal, preciso y orientado a competencias.',
  },
  {
    key: 'cliente',
    label: 'Cliente potencial',
    description: 'Tono comercial y orientado al valor.',
  },
  {
    key: 'estudiante',
    label: 'Estudiante',
    description: 'Tono pedagógico y explicativo.',
  },
  {
    key: 'colega',
    label: 'Colega profesional',
    description: 'Tono técnico y colaborativo.',
  },
  {
    key: 'general',
    label: 'Público general',
    description: 'Tono cercano y profesional.',
  },
]
