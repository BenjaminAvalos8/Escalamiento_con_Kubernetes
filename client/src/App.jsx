import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState({ difusion: 'Verificando...', eventos: 'Verificando...' })

  useEffect(() => {
    // Health check de difusión vía reverse proxy Nginx
    fetch('/health-difusion')
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(() => setStatus(s => ({ ...s, difusion: 'Online' })))
      .catch(() => setStatus(s => ({ ...s, difusion: 'Offline' })))

    // Health check de eventos vía reverse proxy Nginx
    fetch('/health-eventos')
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(() => setStatus(s => ({ ...s, eventos: ' Online' })))
      .catch(() => setStatus(s => ({ ...s, eventos: 'Offline' })))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>🐜 AntHill – Dashboard</h1>
      <p style={{ color: '#888' }}>Panel de control de la simulación de hormigas</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
        <Card title="Difusión (WebSocket)" value={status.difusion} />
        <Card title="Eventos (API REST)" value={status.eventos} />
        <Card title="Motor del mundo" value="Tick loop activo" />
        <Card title="Decisión de agentes" value="Worker conectado a Redis" />
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a2e', borderRadius: 8 }}>
        <h3 style={{ margin: 0 }}>Estado del clúster</h3>
        <p style={{ color: '#ccc', marginTop: '0.5rem' }}>
          Los 4 microservicios y Redis están operando dentro de Kubernetes local.
        </p>
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div style={{
      padding: '1.5rem',
      background: '#16213e',
      borderRadius: 8,
      border: '1px solid #0f3460',
    }}>
      <h4 style={{ margin: 0, color: '#e94560' }}>{title}</h4>
      <p style={{ margin: '0.5rem 0 0', fontSize: '1.1rem' }}>{value}</p>
    </div>
  )
}

export default App
