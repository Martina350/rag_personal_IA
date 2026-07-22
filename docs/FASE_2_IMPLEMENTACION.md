# Fase 2 — Implementación (monorepo, API y frontend)

Documento de cierre operativo de la **Fase 2** y de las fases de entrega web (D/E) más la reorganización **Fase F**.  
El `README.md` pedagógico de la raíz **no se modifica**; esta guía describe cómo está montado el proyecto hoy.

## 1. Arquitectura monorepo

```text
rag_personal_IA/
├── README.md                 # Guía pedagógica original (sin cambios de esta fase)
├── docs/
│   ├── EJERCICIOS.md
│   ├── FASE_2_AUTENTICACION.md
│   └── FASE_2_IMPLEMENTACION.md   # Este archivo
├── backend/                  # Python: RAG + auth + FastAPI
│   ├── src/                  # RAG (ingest, chat CLI, permisos)
│   ├── auth/                 # Autenticación PostgreSQL
│   ├── api/                  # FastAPI
│   ├── data/raw/             # PDFs autorizados
│   ├── storage/qdrant/       # Índice vectorial local
│   ├── tests/
│   ├── evaluation/
│   ├── scripts/
│   ├── requirements.txt
│   └── .env                  # Secretos y configuración backend
├── frontend/                 # React + Vite (Fase E)
│   ├── src/
│   └── .env                  # VITE_API_BASE_URL
└── .venv/                    # Entorno virtual (raíz del repo)
```

### Responsabilidades

| Capa | Carpeta | Función |
|------|---------|---------|
| RAG | `backend/src` | Ingestión, Qdrant, Ollama, privacidad |
| Auth | `backend/auth` | Usuarios, sesiones, matriz de permisos |
| API | `backend/api` | HTTP para el frontend |
| UI | `frontend` | Login, inicio, consultar |

El frontend **solo** llama a la API. No usa LlamaIndex, Qdrant ni PostgreSQL directamente.

---

## 2. Requisitos previos

- Python 3.11+ / 3.12
- Ollama con `qwen2.5:3b` y `nomic-embed-text`
- PostgreSQL + base `rag_auth` (pgAdmin)
- Node.js 20+ (solo frontend)

---

## 3. Puesta en marcha del backend

Desde la **raíz del repositorio**:

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
pip install -r requirements.txt
# Si aún no existe:
# Copy-Item .env.example .env
```

Ajuste `DATABASE_URL` en `backend/.env`.

```powershell
python -m auth.cli init-db
python -m auth.cli login
python -m src.cli check
python -m src.cli ingest
```

### API FastAPI

Con el venv activo y el directorio de trabajo en `backend`:

```powershell
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

- Docs: http://127.0.0.1:8000/docs  
- Health: http://127.0.0.1:8000/health  

Endpoints usados por la UI:

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/auth/login` | Token Bearer |
| GET | `/auth/me` | Rol y permisos |
| POST | `/auth/logout` | Cerrar sesión |
| POST | `/chat` | Pregunta RAG (fuentes solo admin) |
| GET | `/health` | Estado |

Otras utilidades CLI:

```powershell
python -m auth.cli change-password
python -m auth.cli create-user --username ana --role reclutador
python -m auth.cli whoami
python -m src.cli chat
```

---

## 4. Puesta en marcha del frontend (Fase E)

En **otra** terminal, desde la raíz:

```powershell
cd frontend
npm install
npm run dev
```

Abrir http://127.0.0.1:5173  

`frontend/.env` debe apuntar a la API:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Alcance de la UI (EJERCICIOS)

- Pantalla de inicio  
- Selección de tono (rol conversacional)  
- Campo de pregunta  
- Historial local  
- Indicador de carga  
- Mensajes de error seguros  
- Diseño adaptable  
- Sin rutas internas  
- Fuentes solo para administrador  
- Reglas de privacidad del backend  

No incluye panel de administración web (queda para una ampliación futura).

---

## 5. Nota importante: Qdrant local (un solo proceso)

Qdrant está en modo **embebido** en `backend/storage/qdrant` (archivo en disco), no como servidor Docker.

**Solo un proceso** puede abrir esa carpeta a la vez.

| Situación | Qué hacer |
|-----------|-----------|
| API (`uvicorn`) en marcha | Use la UI o Insomnia; **no** ejecute `src.cli chat` en paralelo |
| Quiere `ingest` o `chat` por CLI | Detenga `uvicorn` (Ctrl+C), ejecute el comando, vuelva a levantar la API |
| Error de bloqueo / lock en Qdrant | Cierre el otro proceso que usa `storage/qdrant` |

Esto no es un fallo de Ollama ni de Postgres: es una limitación del almacenamiento vectorial local.

---

## 6. Autenticación y autorización (resumen)

1. **Auth (quién entra):** PostgreSQL — usuarios, roles, sesiones, auditoría, bloqueo, `change-password`.  
2. **Permisos (qué ve):** matriz perfil / certificaciones / proyectos / sensible=no.  
3. **Tono (cómo responde):** selector en la UI o `/rol` en CLI; no sustituye los permisos del login.  

Documento de diseño: `docs/FASE_2_AUTENTICACION.md`.

---

## 7. Mapa de fases entregadas

| Fase | Contenido | Estado |
|------|-----------|--------|
| A | Entorno, carpetas, PostgreSQL | Hecho |
| B | Auth por consola | Hecho |
| C | Filtro RAG por permisos | Hecho |
| D | FastAPI | Hecho |
| E | Frontend React-Vite | Hecho |
| F | Monorepo `backend/` + `frontend/` y este documento | Hecho |

---

## 8. Pruebas rápidas

```powershell
# Desde backend/
python -m pytest tests -q

# API + UI
# Terminal 1: uvicorn ...
# Terminal 2: cd frontend && npm run dev
```

Login con un usuario creado (`admin`, `reclutador1`, etc.) y una pregunta corta sobre el CV o el certificado.

---

## 9. Ampliaciones posibles (fuera del alcance actual)

- Panel admin en la web (usuarios / auditoría)  
- Historial de chat en servidor  
- Separar PDFs de proyectos para filtrar mejor el recurso `projects`  
- Qdrant en servidor (si se necesita multi-proceso)

Fin del documento de implementación.
