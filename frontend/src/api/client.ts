import type { ChatResponse, LoginResponse, UserMe } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || ''

const CHAT_TIMEOUT_MS = 300_000

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function friendlyMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : ''
  const lower = text.toLowerCase()

  if (status === 401) {
    if (lower.includes('bloqueada') || lower.includes('bloqueado')) {
      return 'El acceso fue bloqueado temporalmente. Intenta nuevamente más tarde.'
    }
    if (lower.includes('expir') || lower.includes('revocad')) {
      return 'Tu sesión expiró por seguridad. Inicia sesión nuevamente.'
    }
    if (lower.includes('credencial') || lower.includes('inválid') || lower.includes('invalid')) {
      return 'Las credenciales ingresadas no son válidas.'
    }
    return text || 'Tu sesión expiró por seguridad. Inicia sesión nuevamente.'
  }
  if (status === 403) {
    return 'Tu rol no tiene autorización para consultar esta información.'
  }
  if (status === 503) {
    return 'El servicio de análisis no está disponible temporalmente.'
  }
  if (status >= 500) {
    return 'No pudimos completar la solicitud. Intenta nuevamente.'
  }
  return text || 'No pudimos completar la solicitud. Intenta nuevamente.'
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown = null
  try {
    const data = await response.json()
    detail = data.detail ?? data.message ?? null
  } catch {
    detail = null
  }
  return new ApiError(friendlyMessage(response.status, detail), response.status)
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 30_000, ...init } = options
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })
    if (!response.ok) {
      throw await parseError(response)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'La consulta está tardando más de lo esperado. Intenta de nuevo en unos momentos.',
        408,
      )
    }
    throw new ApiError(
      'El servicio de análisis no está disponible temporalmente.',
      0,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

export function login(username: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe(token: string) {
  return request<UserMe>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function logout(token: string) {
  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function askChat(token: string, question: string, toneKey: string) {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, tone_key: toneKey }),
    timeoutMs: CHAT_TIMEOUT_MS,
  })
}
