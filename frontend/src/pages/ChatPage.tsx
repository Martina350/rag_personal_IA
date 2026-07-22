import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Check,
  Clock3,
  Copy,
  FolderOpen,
  History,
  MessageSquareText,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

function toneLabel(key: string) {
  return TONE_OPTIONS.find((tone) => tone.key === key)?.label ?? key
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
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toneOpen, setToneOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const messagesRef = useRef<HTMLDivElement>(null)
  const toneMenuRef = useRef<HTMLDivElement>(null)
  const historyPanelRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<number | null>(null)

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

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [activeId, loading, pendingQuestion, history])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (toneOpen && toneMenuRef.current && !toneMenuRef.current.contains(target)) {
        setToneOpen(false)
      }
      if (historyOpen && historyPanelRef.current && !historyPanelRef.current.contains(target)) {
        const trigger = (event.target as HTMLElement).closest?.('[data-history-trigger]')
        if (!trigger) setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [toneOpen, historyOpen])

  const active = useMemo(
    () => history.find((item) => item.id === activeId) || null,
    [history, activeId],
  )

  const selectedTone = TONE_OPTIONS.find((tone) => tone.key === toneKey) ?? TONE_OPTIONS[4]

  async function runQuery(nextQuestion: string) {
    if (!token || !user || !nextQuestion.trim() || loading) return

    setError(null)
    setFeedback(null)
    setCopied(false)
    setElapsedMs(null)
    setPendingQuestion(nextQuestion.trim())
    setLoading(true)
    startedAtRef.current = performance.now()

    try {
      const result = await askChat(token, nextQuestion.trim(), toneKey)
      const duration = startedAtRef.current ? performance.now() - startedAtRef.current : null
      setElapsedMs(duration)
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        question: nextQuestion.trim(),
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
      setPendingQuestion(null)
    } catch (err) {
      setPendingQuestion(null)
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        setError(err.message)
        return
      }
      setError(err instanceof ApiError ? err.message : 'No pudimos completar la solicitud. Intenta nuevamente.')
    } finally {
      setLoading(false)
      startedAtRef.current = null
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await runQuery(question)
  }

  function clearHistory() {
    if (!user) return
    setHistory([])
    setActiveId(null)
    localStorage.removeItem(`${HISTORY_KEY}:${user.username}`)
  }

  function startNewAnalysis() {
    setActiveId(null)
    setPendingQuestion(null)
    setQuestion('')
    setError(null)
    setFeedback(null)
    setCopied(false)
    setElapsedMs(null)
    setHistoryOpen(false)
    setToneOpen(false)
  }

  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const showUserBubble = Boolean(pendingQuestion || active)
  const userText = pendingQuestion || active?.question || ''
  const userTime = active && !pendingQuestion ? formatTime(active.createdAt) : formatTime(new Date().toISOString())

  return (
    <div className="chat-page">
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="chat-shell">
        <header className="chat-topbar">
          <button type="button" className="chat-topbar-new" onClick={startNewAnalysis} disabled={loading}>
            <Sparkles size={18} strokeWidth={1.8} />
            <span>Nuevo Análisis</span>
          </button>

          <div className="chat-topbar-right">
            <div className="chat-topbar-secure">
              <ShieldCheck size={16} strokeWidth={1.8} />
              <span>Conexión segura</span>
            </div>

            <div className="chat-topbar-history" ref={historyPanelRef}>
              <button
                type="button"
                className={`chat-icon-btn${historyOpen ? ' active' : ''}`}
                data-history-trigger
                aria-label="Abrir historial"
                title="Historial"
                onClick={() => {
                  setHistoryOpen((open) => !open)
                  setToneOpen(false)
                }}
              >
                <History size={18} strokeWidth={1.8} />
                {history.length > 0 ? <span className="chat-icon-badge">{history.length}</span> : null}
              </button>

              {historyOpen ? (
                <div className="history-panel" role="dialog" aria-label="Historial de consultas">
                  <div className="history-panel-head">
                    <div>
                      <strong>Historial</strong>
                      <p className="muted">Consultas recientes de esta sesión</p>
                    </div>
                    <div className="history-panel-actions">
                      <button
                        type="button"
                        className="chat-icon-btn danger"
                        onClick={clearHistory}
                        disabled={!history.length}
                        title="Limpiar historial"
                        aria-label="Limpiar historial"
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="chat-icon-btn"
                        onClick={() => setHistoryOpen(false)}
                        aria-label="Cerrar historial"
                      >
                        <X size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>

                  {history.length === 0 ? (
                    <p className="empty history-empty">Aún no hay consultas en esta sesión.</p>
                  ) : (
                    <div className="history-list">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`history-item${item.id === activeId ? ' active' : ''}`}
                          onClick={() => {
                            setActiveId(item.id)
                            setHistoryOpen(false)
                            setFeedback(null)
                            setCopied(false)
                            setElapsedMs(null)
                            setPendingQuestion(null)
                          }}
                        >
                          <span className="history-item-icon" aria-hidden>
                            <MessageSquareText size={16} strokeWidth={1.8} />
                          </span>
                          <span className="history-item-body">
                            <strong>
                              {item.question.length > 72 ? `${item.question.slice(0, 72)}…` : item.question}
                            </strong>
                            <span>
                              {formatDateTime(item.createdAt)} · {toneLabel(item.toneKey)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="chat-messages" ref={messagesRef}>
          {!showUserBubble && !loading ? (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden>
                <Sparkles size={28} strokeWidth={1.6} />
              </div>
              <h2>¿En qué puedo ayudarte?</h2>
              <p className="muted">
                Pregunta sobre el perfil, certificaciones o proyectos según tus permisos.
              </p>
            </div>
          ) : null}

          {showUserBubble ? (
            <div className="chat-row user">
              <div className="chat-bubble user">{userText}</div>
              <time className="chat-time">{userTime}</time>
            </div>
          ) : null}

          {loading ? (
            <div className="chat-row assistant">
              <div className="chat-avatar" aria-hidden>
                <Sparkles size={18} strokeWidth={1.8} />
              </div>
              <div className="assistant-card">
                <div className="assistant-card-head">
                  <div>
                    <h3>Analizando consulta</h3>
                    <p className="assistant-meta">
                      <Clock3 size={14} strokeWidth={1.8} />
                      Procesando respuesta…
                    </p>
                  </div>
                </div>
                <ul className="loading-steps">
                  {LOADING_STEPS.map((label, index) => (
                    <li key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>
                      <span className="dot" />
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="skeleton" style={{ marginTop: 12 }}>
                  <div className="skeleton-line" style={{ width: '90%' }} />
                  <div className="skeleton-line" style={{ width: '100%' }} />
                  <div className="skeleton-line" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          ) : null}

          {!loading && active ? (
            <div className="chat-row assistant">
              <div className="chat-avatar" aria-hidden>
                <Sparkles size={18} strokeWidth={1.8} />
              </div>
              <article className="assistant-card">
                <div className="assistant-card-head">
                  <div>
                    <h3>Análisis de candidatos</h3>
                    <p className="assistant-meta">
                      <Clock3 size={14} strokeWidth={1.8} />
                      {elapsedMs != null
                        ? `Generado en ${(elapsedMs / 1000).toFixed(1)}s`
                        : `Tono · ${toneLabel(active.toneKey)}`}
                    </p>
                  </div>
                  <div className="assistant-actions">
                    <button
                      type="button"
                      className="chat-icon-btn"
                      title={copied ? 'Copiado' : 'Copiar'}
                      aria-label="Copiar respuesta"
                      onClick={() => void copyAnswer(active.answer)}
                    >
                      {copied ? <Check size={16} strokeWidth={1.8} /> : <Copy size={16} strokeWidth={1.8} />}
                    </button>
                    <button
                      type="button"
                      className={`chat-icon-btn${feedback === 'up' ? ' active' : ''}`}
                      title="Útil"
                      aria-label="Marcar como útil"
                      onClick={() => setFeedback((value) => (value === 'up' ? null : 'up'))}
                    >
                      <ThumbsUp size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className={`chat-icon-btn${feedback === 'down' ? ' active' : ''}`}
                      title="No útil"
                      aria-label="Marcar como no útil"
                      onClick={() => setFeedback((value) => (value === 'down' ? null : 'down'))}
                    >
                      <ThumbsDown size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      className="chat-icon-btn"
                      title="Regenerar"
                      aria-label="Regenerar respuesta"
                      disabled={loading}
                      onClick={() => void runQuery(active.question)}
                    >
                      <RefreshCw size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>

                <div className="assistant-content">{active.answer}</div>

                {active.filtered ? (
                  <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                    La respuesta fue generada utilizando únicamente la información autorizada para tu rol.
                  </div>
                ) : null}

                {user?.is_admin && active.sources.length > 0 ? (
                  <div className="admin-sources">
                    <strong>
                      <FolderOpen size={16} strokeWidth={1.8} />
                      ADMIN VIEW: Fuentes de Datos
                    </strong>
                    <ul>
                      {active.sources.map((source, index) => (
                        <li key={`${source.file_name}-${index}`}>
                          +/{source.file_name} — {source.document_type}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="muted assistant-footnote">Información obtenida de documentos autorizados.</p>
                )}

                <footer className="assistant-privacy">
                  <Shield size={14} strokeWidth={1.8} />
                  Privacidad: Respuesta generada por IA local. Información procesada según los permisos de tu rol.
                </footer>
              </article>
            </div>
          ) : null}
        </div>

        <form className="chat-composer" onSubmit={onSubmit}>
          <div className="composer-box">
            <textarea
              id="question"
              rows={1}
              maxLength={4000}
              placeholder="Ej: ¿Cuáles son las habilidades blandas de los candidatos seleccionados?"
              value={question}
              disabled={loading}
              aria-label="Pregunta"
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

            <div className="composer-toolbar">
              <div className="composer-tone" ref={toneMenuRef}>
                <button
                  type="button"
                  className={`composer-tool-btn${toneOpen ? ' active' : ''}`}
                  aria-label="Seleccionar tono"
                  title={`Tono: ${selectedTone.label}`}
                  disabled={loading}
                  onClick={() => {
                    setToneOpen((open) => !open)
                    setHistoryOpen(false)
                  }}
                >
                  <SlidersHorizontal size={18} strokeWidth={1.8} />
                </button>

                {toneOpen ? (
                  <div className="tone-popover" role="listbox" aria-label="Selección de tono">
                    <p className="tone-popover-title">Tono de respuesta</p>
                    {TONE_OPTIONS.map((tone) => (
                      <button
                        key={tone.key}
                        type="button"
                        role="option"
                        aria-selected={toneKey === tone.key}
                        className={`tone-option${toneKey === tone.key ? ' active' : ''}`}
                        onClick={() => {
                          setToneKey(tone.key)
                          setToneOpen(false)
                        }}
                      >
                        <strong>{tone.label}</strong>
                        <span>{tone.description}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                className="composer-send"
                disabled={!question.trim() || loading}
                aria-label={loading ? 'Consultando' : 'Enviar pregunta'}
                title="Enviar"
              >
                <Send size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <p className="composer-tone-chip muted">
            Tono activo: <strong>{selectedTone.label}</strong>
          </p>
        </form>
      </div>
    </div>
  )
}
