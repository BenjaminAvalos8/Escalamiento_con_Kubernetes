import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import ContadorAgentes from './components/ContadorAgentes.jsx'
import MetricasInfraestructura from './components/MetricasInfraestructura.jsx'
import MapaEcosistema from './components/MapaEcosistema.jsx'

function App() {
  const [status, setStatus] = useState({ difusion: 'Desconectado', eventos: 'Verificando...' })
  const [agentes, setAgentes] = useState([])
  const [tick, setTick] = useState(0)
  const [replicasDecision, setReplicasDecision] = useState(1)

  useEffect(() => {
    fetch('/health-eventos')
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(() => setStatus(s => ({ ...s, eventos: 'Online' })))
      .catch(() => setStatus(s => ({ ...s, eventos: 'Offline' })))

    const fetchMetricas = () => {
      fetch('/api/metricas/infraestructura')
        .then(r => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then(d => {
          if (typeof d?.replicasDecision === 'number') {
            setReplicasDecision(d.replicasDecision)
          }
        })
        .catch(() => {})
    }

    fetchMetricas()
    const intervalMetricas = setInterval(fetchMetricas, 2000)

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setStatus(s => ({ ...s, difusion: 'Online' }))
    })

    socket.on('disconnect', () => {
      setStatus(s => ({ ...s, difusion: 'Offline' }))
    })

    socket.on('mundo:estado', (data) => {
      if (Array.isArray(data?.agentes)) {
        setAgentes(data.agentes)
        setTick(data.tick || 0)
      }
    })

    return () => {
      clearInterval(intervalMetricas)
      socket.disconnect()
    }
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <ContadorAgentes agentes={agentes.length} />
      <MetricasInfraestructura replicasDecision={replicasDecision} />

      <h1>AntHill – Dashboard</h1>
      <p style={{ color: '#888' }}>
        Panel de control de la simulacion | Tick actual: {tick}
      </p>

      <MapaEcosistema agentes={agentes} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
        <Card title="Difusion (WebSocket)" value={status.difusion} />
        <Card title="Eventos (API REST)" value={status.eventos} />
        <Card title="Motor del mundo" value={agentes.length > 0 ? 'Tick activo' : 'Esperando datos'} />
        <Card title="Decision de agentes" value={`${replicasDecision} Pod(s) activo(s)`} />
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div style={{
      padding: '1.2rem',
      background: '#16213e',
      borderRadius: 8,
      border: '1px solid #0f3460',
    }}>
      <h4 style={{ margin: 0, color: '#e94560' }}>{title}</h4>
      <p style={{ margin: '0.4rem 0 0', fontSize: '1rem' }}>{value}</p>
    </div>
  )
}

export default App
