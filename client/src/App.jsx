import { useState, useEffect, useRef } from 'react'
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
  const [replicasDifusion, setReplicasDifusion] = useState(1)
  const [camInfo, setCamInfo] = useState({ cellX: 500, cellY: 500, zoom: '0.50' })
  const [tps, setTps] = useState(0)
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0)
  const ticksRecibidosRef = useRef(0)

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
          if (typeof d?.replicasDifusion === 'number') {
            setReplicasDifusion(d.replicasDifusion)
          }
        })
        .catch(() => {})
    }

    fetchMetricas()
    const intervalMetricas = setInterval(fetchMetricas, 2000)

    const timerInterval = setInterval(() => {
      setSegundosTranscurridos(s => s + 1)
      setTps(ticksRecibidosRef.current)
      ticksRecibidosRef.current = 0
    }, 1000)

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
      ticksRecibidosRef.current += 1
      if (Array.isArray(data?.agentes)) {
        setAgentes(data.agentes)
        setTick(data.tick || 0)
      }
    })

    return () => {
      clearInterval(intervalMetricas)
      clearInterval(timerInterval)
      socket.disconnect()
    }
  }, [])

  const inyectarCarga = (cantidad) => {
    fetch('/api/admin/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    }).catch(() => {})
  }

  const purgarCarga = (cantidad) => {
    fetch('/api/admin/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    }).catch(() => {})
  }

  return (
    <div className="app-viewport">
      {/* Canvas del mundo 1000x1000 interactivo (fullscreen) */}
      <MapaEcosistema
        agentes={agentes}
        ancho={1000}
        alto={1000}
        onCameraChange={setCamInfo}
      />

      {/* Capa de interfaces flotantes (HUD) */}
      <div className="hud-container">
        {/* HUD Superior Izquierdo: Estado del Sistema */}
        <div className="hud-top-left hud-interactive">
          <div className="hud-card">
            <div className="hud-header">
              <span className="hud-title">Estado del Sistema</span>
              <span className={`hud-badge ${status.difusion === 'Online' ? '' : 'offline'}`}>
                {status.difusion === 'Online' ? 'EN VIVO' : 'OFFLINE'}
              </span>
            </div>

            <ContadorAgentes agentes={agentes.length} />

            <div className="hud-row">
              <span>Tiempo de corrida:</span>
              <span className="val">{(() => {
                const min = String(Math.floor(segundosTranscurridos / 60)).padStart(2, '0');
                const seg = String(segundosTranscurridos % 60).padStart(2, '0');
                const hrs = Math.floor(segundosTranscurridos / 3600);
                return hrs > 0 ? `${hrs}:${min}:${seg}` : `00:${min}:${seg}`;
              })()}</span>
            </div>
            <div className="hud-row">
              <span>Cadencia real (TPS):</span>
              <span className="val">{tps.toFixed(1)} tps</span>
            </div>
            <div className="hud-row">
              <span>Tick del motor:</span>
              <span className="val">{tick}</span>
            </div>
            <div className="hud-row">
              <span>Camara central:</span>
              <span className="val">[{camInfo.cellX}, {camInfo.cellY}]</span>
            </div>
            <div className="hud-row">
              <span>Escala (Zoom):</span>
              <span className="val">{camInfo.zoom}x</span>
            </div>
          </div>
        </div>

        {/* HUD Superior Derecho: Orquestacion Kubernetes */}
        <div className="hud-top-right hud-interactive">
          <div className="hud-card">
            <div className="hud-header">
              <span className="hud-title">Kubernetes (HPA)</span>
              <span className="hud-badge">Namespace: default</span>
            </div>

            <MetricasInfraestructura replicasDecision={replicasDecision} replicasDifusion={replicasDifusion} />

            <div className="hud-row">
              <span>Motor del mundo:</span>
              <span className="val">1 replica (fija)</span>
            </div>
            <div className="hud-row">
              <span>Difusion (WS):</span>
              <span className="val">{status.difusion}</span>
            </div>
            <div className="hud-row">
              <span>Eventos (REST):</span>
              <span className="val">{status.eventos}</span>
            </div>
          </div>
        </div>

        {/* Panel Inferior Central: Controles de Carga */}
        <div className="hud-bottom-center hud-interactive">
          <div className="hud-card action-bar">
            <button
              onClick={() => inyectarCarga(100)}
              className="btn-action btn-spawn"
            >
              Inyectar carga (+100 agentes)
            </button>
            <button
              onClick={() => purgarCarga(100)}
              className="btn-action btn-purge"
            >
              Purgar carga (-100 agentes)
            </button>
          </div>
          <div className="hud-tip">
            Arrastra con el mouse para mover la camara | Rueda del mouse para zoom
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
