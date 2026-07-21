import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { askChat, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { TONE_OPTIONS, type HistoryItem } from '../types'

const HISTORY_KEY = 'rag_chat_history'

function loadHistory(username: string): HistoryItem[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY}:${username}`)
    if (!raw) return []
    return JSON.parse(raw) as HistoryItem[]
  } catch {
    return []
  }
}

function saveHistory(username: string, items: HistoryItem[]) {
  localStorage.setItem(`${HISTORY_KEY}:${username}`, JSON.stringify(items.slice(0, 30)))
}

const LOADING_STEPS = [
  'Validando permisos',
  'Recuperando información autorizada',
  'Analizando documentos',
  'Generando respuesta',
]

export function ChatPage() {
  const { token, user, clearSession } = useAuth()
  const [toneKey, setToneKey] = useState(user?.tone_key || 'general')
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory(user?.username || ''))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.tone_key) setToneKey(user.tone_key)
  }, [user?.tone_key])

  useEffect(() => {
    if (!loading) return
    setStep(0)
    const timers = [
      window.setTimeout(() => setStep(1), 1200),
      window.setTimeout(() => setStep(2), 2800),
      window.setTimeout(() => setStep(3), 5000),
    ]
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [loading])

  const active = useMemo(
    () => history.find((item) => item.id === activeId) || null,
    [history, activeId],
  )

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !user || !question.trim() || loading) return

    setError(null)
    setLoading(true)
    try {
      const result = await askChat(token, question.trim(), toneKey)
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        question: question.trim(),
        answer: result.answer,
        toneKey,
        filtered: result.filtered,
        sources: user.is_admin ? result.sources : [],
        createdAt: new Date().toISOString(),
      }
      const next = [item, ...history]
      setHistory(next)
      saveHistory(user.username, next)
      setActiveId(item.id)
      setQuestion('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        setError(err.message)
        return
      }
      setError(err instanceof ApiError ? err.message : 'No pudimos completar la solicitud. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    if (!user) return
    setHistory([])
    setActiveId(null)
    localStorage.removeItem(`${HISTORY_KEY}:${user.username}`)
  }

  return (
    <div>
      <h1>Consultar</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Selecciona el tono de respuesta y formula tu pregunta. El acceso a la información depende de tu rol.
      </p>

      <div className="chat-layout">
        <aside className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Historial</h2>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 36 }} onClick={clearHistory} disabled={!history.length}>
              Limpiar
            </button>
          </div>
          {history.length === 0 ? (
            <p className="empty">Aún no hay consultas en esta sesión.</p>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`history-item${item.id === activeId ? ' active' : ''}`}
                  onClick={() => setActiveId(item.id)}
                >
                  <strong>{item.question.length > 80 ? `${item.question.slice(0, 80)}…` : item.question}</strong>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="card">
          <h2 style={{ fontSize: '1.125rem' }}>Selección de tono</h2>
          <p className="muted" style={{ marginBottom: 12, fontSize: '0.875rem' }}>
            Define cómo debe redactarse la respuesta. Tus permisos de acceso no cambian.
          </p>
          <div className="tone-grid" style={{ marginBottom: 20 }}>
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.key}
                type="button"
                className={`tone-card${toneKey === tone.key ? ' active' : ''}`}
                onClick={() => setToneKey(tone.key)}
              >
                <strong>{tone.label}</strong>
                <span>{tone.description}</span>
              </button>
            ))}
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="messages">
            {loading ? (
              <div className="message">
                <div className="message-meta">Procesando consulta</div>
                <ul className="loading-steps">
                  {LOADING_STEPS.map((label, index) => (
                    <li key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>
                      <span className="dot" />
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="skeleton" style={{ marginTop: 16 }}>
                  <div className="skeleton-line" style={{ width: '90%' }} />
                  <div className="skeleton-line" style={{ width: '100%' }} />
                  <div className="skeleton-line" style={{ width: '75%' }} />
                </div>
              </div>
            ) : active ? (
              <>
                <div className="message user">
                  <div className="message-meta">Tu pregunta · {new Date(active.createdAt).toLocaleString()}</div>
                  <div>{active.question}</div>
                </div>
                <div className="message">
                  <div className="message-meta">Respuesta generada · tono {active.toneKey}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{active.answer}</div>
                  {active.filtered ? (
                    <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                      La respuesta fue generada utilizando únicamente la información autorizada para tu rol.
                    </div>
                  ) : null}
                  {user?.is_admin && active.sources.length > 0 ? (
                    <div className="sources">
                      <strong>Fuentes consultadas</strong>
                      <ul>
                        {active.sources.map((source, index) => (
                          <li key={`${source.file_name}-${index}`}>
                            {source.file_name} — {source.document_type}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 12, fontSize: '0.875rem' }}>
                      Información obtenida de documentos autorizados.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty">Escribe una pregunta para comenzar.</p>
            )}
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="question">Pregunta</label>
              <textarea
                id="question"
                rows={3}
                maxLength={4000}
                placeholder="Escribe una pregunta sobre el perfil…"
                value={question}
                disabled={loading}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (question.trim() && !loading) {
                      void onSubmit(e as unknown as FormEvent)
                    }
                  }
                }}
              />
            </div>
            <div className="composer-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!question || loading}
                onClick={() => setQuestion('')}
              >
                Limpiar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!question.trim() || loading}>
                {loading ? 'Consultando…' : 'Enviar'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
