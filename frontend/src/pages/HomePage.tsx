import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function HomePage() {
  const { user } = useAuth()

  return (
    <div>
      <h1>
        {greeting()}, {user?.username}
      </h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Consulta información autorizada sobre el perfil, certificaciones y proyectos según tu rol.
      </p>

      <div className="card-grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>Nueva consulta</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Haz una pregunta sobre los documentos autorizados.
          </p>
          <Link to="/consultar" className="btn btn-primary">
            Empezar
          </Link>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>Rol activo</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            {user?.role_label}
          </p>
          <p className="muted" style={{ fontSize: '0.875rem' }}>
            El acceso a la información se filtra automáticamente según tus permisos.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>Privacidad</h2>
          <p className="muted" style={{ fontSize: '0.875rem' }}>
            No se revelan datos de contacto, familiares ni información sensible. Las fuentes detalladas
            solo están disponibles para administradores.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.125rem' }}>Preguntas sugeridas</h2>
        <ul className="muted">
          <li>¿Qué experiencia profesional destaca?</li>
          <li>Resume las certificaciones relevantes.</li>
          <li>¿Qué tecnologías aparecen en los proyectos?</li>
        </ul>
        <Link to="/consultar" className="btn btn-ghost" style={{ marginTop: 8 }}>
          Ir a consultar
        </Link>
      </div>
    </div>
  )
}
