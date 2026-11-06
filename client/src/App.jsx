import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import ContadorAgentes from './components/ContadorAgentes.jsx'
import MetricasInfraestructura from './components/MetricasInfraestructura.jsx'
import MapaEcosistema from './components/MapaEcosistema.jsx'

const crearAgentesMock = (n = 100) =>
  Array.from({ length: n }, (_, id) => ({
    id,
    x: Math.max(0, Math.min(999, 500 + Math.floor(Math.random() * 60) - 30)),
    y: Math.max(0, Math.min(999, 500 + Math.floor(Math.random() * 60) - 30)),
  }))

const crearRecursosMock = (n = 200) => {
  const lista = []
  let id = 1
  const focos = [
    { x: 500, y: 500, disp: 110, cant: Math.floor(n * 0.45) },
    { x: 280, y: 280, disp: 70, cant: Math.floor(n * 0.15) },
    { x: 720, y: 280, disp: 70, cant: Math.floor(n * 0.15) },
    { x: 300, y: 720, disp: 70, cant: Math.floor(n * 0.12) },
    { x: 720, y: 720, disp: 70, cant: Math.floor(n * 0.13) },
  ]
  for (const f of focos) {
    for (let i = 0; i < f.cant; i++) {
      lista.push({
        id: id++,
        x: Math.max(0, Math.min(999, Math.round(f.x + (Math.random() * 2 - 1) * f.disp))),
        y: Math.max(0, Math.min(999, Math.round(f.y + (Math.random() * 2 - 1) * f.disp))),
        valor: 1,
      })
    }
  }
  return lista
}

function App() {
  const [status, setStatus] = useState({ difusion: 'Desconectado', eventos: 'Verificando...' })
  const [agentes, setAgentes] = useState(() => crearAgentesMock(100))
  const [recursos, setRecursos] = useState(() => crearRecursosMock(200))
  const [depredadores, setDepredadores] = useState([])
  const [eventosActivos, setEventosActivos] = useState([])
  const [tick, setTick] = useState(0)
  const [replicasDecision, setReplicasDecision] = useState(1)
  const [replicasDifusion, setReplicasDifusion] = useState(1)
  const [camInfo, setCamInfo] = useState({ cellX: 500, cellY: 500, zoom: '0.50' })
  const [tps, setTps] = useState(0)
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0)
  const [duracionTickMs, setDuracionTickMs] = useState(0)
  const [saturado, setSaturado] = useState(false)
  const [modoTestSaturado, setModoTestSaturado] = useState(false)
  const [umbralAgregado, setUmbralAgregado] = useState(300)

  // HU15: Cooldown Sequia | HU16: Cooldown Depredador
  const [cooldownSequia, setCooldownSequia] = useState(0)
  const [cooldownDepredador, setCooldownDepredador] = useState(0)
  const [feedbackEvento, setFeedbackEvento] = useState('')

  const ticksRecibidosRef = useRef(0)

  // Reloj de cuenta regresiva para cooldowns
  useEffect(() => {
    if (cooldownSequia <= 0 && cooldownDepredador <= 0) return
    const timer = setInterval(() => {
      setCooldownSequia(c => Math.max(0, c - 1))
      setCooldownDepredador(c => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSequia, cooldownDepredador])

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
      if (Array.isArray(data?.recursos)) {
        setRecursos(data.recursos)
      }
      if (Array.isArray(data?.depredadores)) {
        setDepredadores(data.depredadores)
      }
      if (Array.isArray(data?.eventosActivos)) {
        setEventosActivos(data.eventosActivos)
      }
      if (typeof data?.duracionTickMs === 'number') {
        setDuracionTickMs(data.duracionTickMs)
        if (data.duracionTickMs > 150) {
          setSaturado(true)
        } else if (data.duracionTickMs < 100) {
          setSaturado(false)
        }
      }
    })

    return () => {
      clearInterval(intervalMetricas)
      clearInterval(timerInterval)
      socket.disconnect()
    }
  }, [])

  // Movimiento local autonomo cuando el backend difusion no esta conectado
  useEffect(() => {
    if (status.difusion === 'Online') return
    const interval = setInterval(() => {
      setTick(t => t + 1)
      setAgentes(prev =>
        prev.map(a => ({
          ...a,
          x: Math.max(0, Math.min(999, a.x + Math.floor(Math.random() * 3) - 1)),
          y: Math.max(0, Math.min(999, a.y + Math.floor(Math.random() * 3) - 1)),
        }))
      )
      // HU16: Mover depredadores localmente y decrementar su vida
      setDepredadores(prev =>
        prev
          .map(dep => ({
            ...dep,
            x: Math.max(0, Math.min(999, dep.x + Math.floor(Math.random() * 7) - 3)),
            y: Math.max(0, Math.min(999, dep.y + Math.floor(Math.random() * 7) - 3)),
            ticksRestantes: dep.ticksRestantes - 1,
          }))
          .filter(dep => dep.ticksRestantes > 0)
      )
    }, 500)
    return () => clearInterval(interval)
  }, [status.difusion])

  const inyectarCarga = (cantidad) => {
    fetch('/api/admin/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    }).catch(() => {})

    if (status.difusion !== 'Online') {
      setAgentes(prev => [
        ...prev,
        ...Array.from({ length: cantidad }, (_, i) => ({
          id: prev.length + i,
          x: Math.max(0, Math.min(999, 500 + Math.floor(Math.random() * 60) - 30)),
          y: Math.max(0, Math.min(999, 500 + Math.floor(Math.random() * 60) - 30)),
        }))
      ])
    }
  }

  const purgarCarga = (cantidad) => {
    fetch('/api/admin/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    }).catch(() => {})

    if (status.difusion !== 'Online') {
      setAgentes(prev => prev.slice(0, Math.max(0, prev.length - cantidad)))
    }
  }

  // HU15: Funcion para disparar evento Sequia con Cooldown
  const dispararSequia = () => {
    if (cooldownSequia > 0) return

    fetch('/api/eventos/sequia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zona: { x: 500, y: 500, radio: 150 } }),
    })
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(d => {
        setCooldownSequia(d.cooldownSegundos || 10)
        setFeedbackEvento('🌵 Evento Sequía aplicado: recursos eliminados en la zona central')
        setTimeout(() => setFeedbackEvento(''), 4000)
      })
      .catch(() => {
        setCooldownSequia(10)
        setFeedbackEvento('🌵 Evento Sequía aplicado en modo local')
        setTimeout(() => setFeedbackEvento(''), 4000)
      })

    // Modo autonomo/local para visualizacion inmediata
    if (status.difusion !== 'Online') {
      setCooldownSequia(10)
      setRecursos(prev =>
        prev.filter(r => {
          const dSq = (r.x - 500) ** 2 + (r.y - 500) ** 2
          return dSq > 150 ** 2
        })
      )
      setEventosActivos(prev => [...prev, { tipo: 'sequia', x: 500, y: 500, radio: 150, ticksRestantes: 20 }])
      setFeedbackEvento('🌵 Evento Sequía aplicado en modo local: recursos eliminados en el centro')
      setTimeout(() => setFeedbackEvento(''), 4000)
    }
  }

  // HU16: Funcion para disparar evento Depredador con Cooldown
  const dispararDepredador = () => {
    if (cooldownDepredador > 0) return

    fetch('/api/eventos/depredador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: 3, zona: { x: 500, y: 500, radio: 200 } }),
    })
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(d => {
        setCooldownDepredador(d.cooldownSegundos || 12)
        setFeedbackEvento('🐍 Depredadores invocados: las hormigas cercanas huyen')
        setTimeout(() => setFeedbackEvento(''), 4000)
      })
      .catch(() => {
        setCooldownDepredador(12)
        setFeedbackEvento('🐍 Depredadores invocados en modo local')
        setTimeout(() => setFeedbackEvento(''), 4000)
      })

    // Modo autonomo/local para visualizacion inmediata
    if (status.difusion !== 'Online') {
      setCooldownDepredador(12)
      const nuevosDeps = []
      for (let i = 0; i < 3; i++) {
        const angulo = Math.random() * Math.PI * 2
        const dist = Math.random() * 120
        nuevosDeps.push({
          id: `dep-local-${Date.now()}-${i}`,
          x: Math.max(0, Math.min(999, Math.round(500 + Math.cos(angulo) * dist))),
          y: Math.max(0, Math.min(999, Math.round(500 + Math.sin(angulo) * dist))),
          ticksRestantes: 25,
          radioAmenaza: 80,
        })
      }
      setDepredadores(prev => [...prev, ...nuevosDeps])
      setEventosActivos(prev => [...prev, { tipo: 'depredador', x: 500, y: 500, radio: 200, ticksRestantes: 25 }])
      setFeedbackEvento('🐍 Depredadores invocados en modo local: las hormigas huyen')
      setTimeout(() => setFeedbackEvento(''), 4000)
    }
  }

  const estaSaturado = saturado || modoTestSaturado

  return (
    <div className="app-viewport">
      {/* Banner de alerta reactiva de saturacion (HU12) */}
      {estaSaturado && (
        <div className="alerta-saturacion-banner" role="alert">
          <span className="alerta-icono">!</span>
          <div className="alerta-texto">
            <strong>ALERTA: SISTEMA SATURADO</strong>
            <span>Tiempo de cálculo del tick: {modoTestSaturado ? 185 : duracionTickMs} ms (&gt; 150 ms). Estrangulamiento detectado.</span>
          </div>
        </div>
      )}

      {/* Toast de notificacion de evento (HU15/HU16) */}
      {feedbackEvento && (
        <div className="alerta-evento-toast" role="status">
          <span>{feedbackEvento}</span>
        </div>
      )}

      {/* Canvas del mundo 1000x1000 interactivo (fullscreen) */}
      <MapaEcosistema
        agentes={agentes}
        recursos={recursos}
        depredadores={depredadores}
        eventosActivos={eventosActivos}
        ancho={1000}
        alto={1000}
        umbralAgregado={umbralAgregado}
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
              <span>Recursos visibles:</span>
              <span className="val" style={{ color: '#34d399', fontWeight: 'bold' }}>
                {recursos.length}
              </span>
            </div>
            <div className="hud-row">
              <span>Depredadores activos:</span>
              <span className="val" style={{ color: '#a855f7', fontWeight: 'bold' }}>
                {depredadores.length}
              </span>
            </div>

            <div className="hud-row">
              <span>Modo del mapa:</span>
              <span className={`val ${agentes.length > umbralAgregado ? 'texto-alerta' : ''}`}>
                {agentes.length > umbralAgregado ? 'Agregado (Calor)' : 'Detallado (Sprites)'}
              </span>
            </div>
            <div
              className="hud-row cursor-clickable"
              onClick={() => setUmbralAgregado(u => (u === 300 ? 150 : u === 150 ? 50 : 300))}
              title="Haz clic para alternar el umbral (50, 150 o 300 agentes) para probar el cambio de modo (HU13)"
            >
              <span>Umbral agregación (HU13):</span>
              <span className="val">{umbralAgregado}</span>
            </div>

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
            <div
              className="hud-row cursor-clickable"
              onClick={() => setModoTestSaturado(s => !s)}
              title="Haz clic para probar la alerta de saturación (HU12)"
            >
              <span>Latencia cálculo tick:</span>
              <span className={`val ${estaSaturado ? 'texto-alerta' : ''}`}>
                {modoTestSaturado ? 185 : duracionTickMs} ms
              </span>
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

        {/* Panel Inferior Central: Controles de Carga y Eventos Ambientales */}
        <div className="hud-bottom-center hud-interactive">
          <div className="hud-card action-bar">
            <button
              onClick={() => inyectarCarga(100)}
              className="btn-action btn-spawn"
              title="Inyecta 100 agentes en la simulación"
            >
              +100 agentes
            </button>
            <button
              onClick={() => purgarCarga(100)}
              className="btn-action btn-purge"
              title="Purga 100 agentes de la simulación"
            >
              -100 agentes
            </button>

            {/* HU15: Boton interactivo de Sequia con Cooldown */}
            <button
              onClick={dispararSequia}
              disabled={cooldownSequia > 0}
              className={`btn-action btn-sequia ${cooldownSequia > 0 ? 'btn-disabled' : ''}`}
              title="HU15: Provoca una sequía eliminando recursos de una zona designada. Cooldown: 10s"
            >
              {cooldownSequia > 0 ? `🌵 Sequía (${cooldownSequia}s)` : '🌵 Provocar Sequía'}
            </button>

            {/* HU16: Boton interactivo de Depredador con Cooldown */}
            <button
              onClick={dispararDepredador}
              disabled={cooldownDepredador > 0}
              className={`btn-action btn-depredador ${cooldownDepredador > 0 ? 'btn-disabled' : ''}`}
              title="HU16: Invoca depredadores temporales que hacen huir a las hormigas cercanas. Cooldown: 12s"
            >
              {cooldownDepredador > 0 ? `🐍 Depredador (${cooldownDepredador}s)` : '🐍 Invocar Depredador'}
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
