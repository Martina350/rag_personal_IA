# Frontend — RAG Personal (Fase E)

Interfaz React + Vite. Consume únicamente la API FastAPI del monorepo.

## Requisitos

1. Activar el venv en la raíz del repo.
2. Backend en marcha desde `backend/`:

```powershell
cd backend
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

3. Node.js 20+.

Guía completa: `docs/FASE_2_IMPLEMENTACION.md`.

## Desarrollo

```powershell
cd frontend
npm install
npm run dev
```

Abrir http://127.0.0.1:5173

## Alcance

- Login autenticado  
- Inicio  
- Consultar (tono + historial local)  
- Carga y errores seguros  
- Fuentes solo administrador  
- Sin panel admin web  
