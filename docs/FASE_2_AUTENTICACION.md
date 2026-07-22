# Fase 2: autenticación y autorización

> Implementación operativa y monorepo: consulte `docs/FASE_2_IMPLEMENTACION.md`.

## Objetivo

Permitir consultas únicamente a usuarios registrados y con claves autorizadas.

## Conceptos

- **Autenticación:** comprobar quién es el usuario.
- **Autorización:** decidir qué puede consultar.
- **Hash:** transformación unidireccional para almacenar contraseñas de forma segura.

Las contraseñas nunca deben guardarse en texto plano.

## Roles propuestos

- administrador;
- reclutador;
- cliente;
- estudiante;
- colega;
- usuario general autorizado.

## Requisitos

1. Registro administrado.
2. Contraseñas con Argon2 o bcrypt.
3. Base de usuarios.
4. Bloqueo temporal tras varios intentos.
5. Auditoría.
6. Matriz de permisos.
7. Expiración de sesión.
8. Revocación de usuarios.
9. Pruebas de autorización.

## Matriz inicial

| Rol | Perfil | Certificaciones | Proyectos | Datos sensibles |
|---|---:|---:|---:|---:|
| Administrador | Sí | Sí | Sí | No por defecto |
| Reclutador | Sí | Sí | Sí | No |
| Cliente | Sí | Parcial | Sí | No |
| Estudiante | Sí | Parcial | Parcial | No |
| General | Sí | Parcial | Parcial | No |

## Actividad

Diseñe una base con tablas `users`, `roles`, `permissions` y `audit_events`
(más `sessions` para expiración). En este repositorio la implementación usa
**PostgreSQL + pgAdmin** (equivalente funcional a SQLite del enunciado pedagógico).

Implemente autenticación por consola antes de migrar a web:

```powershell
python -m auth.cli init-db
python -m auth.cli login
python -m src.cli chat
```

Carpetas previstas del monorepo: `auth/` (fase 2), `api/` (FastAPI), `frontend/` (React-Vite).

### Fase C (autorización sobre el RAG)

Con sesión activa, `PersonalRAG.ask` filtra fragmentos según la matriz:

- `curriculum` → recurso `profile`
- `certificacion` → recurso `certifications`
- `proyecto` → recurso `projects`
- Acceso `partial`: se incluye el fragmento recortado
- Acceso `none`: se excluye; si no queda contexto autorizado, se niega la consulta

### Fase D (API FastAPI)

```powershell
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

- Docs interactivas: http://127.0.0.1:8000/docs
- `POST /auth/login` → token Bearer
- `GET /auth/me`, `POST /auth/logout`
- `POST /chat` → reutiliza `PersonalRAG` + permisos (fuentes solo admin)
- `GET /health`

No abra a la vez `src.cli chat` y la API: Qdrant local usa un solo proceso sobre `storage/qdrant`.

### Fase E (frontend React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

- http://127.0.0.1:5173
- Pantallas: login, inicio, consultar (tono + historial local)
- Solo APIs actuales; sin administración web
