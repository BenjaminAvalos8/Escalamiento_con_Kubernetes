import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import ContadorAgentes from './components/ContadorAgentes.jsx'
import MetricasInfraestructura from './components/MetricasInfraestructura.jsx'
import MapaEcosistema from './components/MapaEcosistema.jsx'
import LuminousCard from './components/LuminousCard.jsx'
import NeumorphicButton from './components/NeumorphicButton.jsx'

// Por encima, el mapa pasa solo a calor para no saturar el navegador (HU13)
const UMBRAL_AGREGADO = 5000
const TICKS_POR_SEGUNDO = 10

const formatearTiempo = (segundos) =>
  [Math.floor(segundos / 3600), Math.floor(segundos / 60) % 60, segundos % 60]
    .map(n => String(n).padStart(2, '0'))
    .join(':')

function App() {
  const [status, setStatus] = useState({ difusion: 'Desconectado', eventos: 'Verificando...' })
  const [agentes, setAgentes] = useState([])
  const [recursos, setRecursos] = useState([])
  const [depredadores, setDepredadores] = useState([])
  const [eventosActivos, setEventosActivos] = useState([])
  const [comidaNido, setComidaNido] = useState(0)
  const [tick, setTick] = useState(0)
  const [infraestructura, setInfraestructura] = useState(null)
  const [camInfo, setCamInfo] = useState({ cellX: 500, cellY: 500, zoom: '0.50' })
  const [tps, setTps] = useState(0)
  const [segundosCorrida, setSegundosCorrida] = useState(0)
  const [duracionTickMs, setDuracionTickMs] = useState(0)
  const [saturado, setSaturado] = useState(false)
  const [calorElegido, setCalorElegido] = useState(false)

  // Cooldowns de eventos (HU15, HU16, HU17)
  const [cooldownSequia, setCooldownSequia] = useState(0)
  const [cooldownDepredador, setCooldownDepredador] = useState(0)
  const [cooldownAbundancia, setCooldownAbundancia] = useState(0)
  const [feedbackEvento, setFeedbackEvento] = useState('')

  const ticksRecibidosRef = useRef(0)

  // Reloj de cuenta regresiva para cooldowns
  useEffect(() => {
    if (cooldownSequia <= 0 && cooldownDepredador <= 0 && cooldownAbundancia <= 0) return
    const timer = setInterval(() => {
      setCooldownSequia(c => Math.max(0, c - 1))
      setCooldownDepredador(c => Math.max(0, c - 1))
      setCooldownAbundancia(c => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSequia, cooldownDepredador, cooldownAbundancia])

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
        .then(setInfraestructura)
        .catch(() => setInfraestructura(null))
    }

    fetchMetricas()
    const intervalMetricas = setInterval(fetchMetricas, 2000)

    let inicioMuestra = performance.now()
    const timerInterval = setInterval(() => {
      const ahora = performance.now()
      setTps(ticksRecibidosRef.current * 1000 / (ahora - inicioMuestra))
      ticksRecibidosRef.current = 0
      inicioMuestra = ahora
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
      setSaturado(false)
    })

    socket.on('mundo:estado', (data) => {
      ticksRecibidosRef.current += 1
      setAgentes(data.agentes)
      setTick(data.tick)
      setRecursos(data.recursos)
      setDepredadores(data.depredadores)
      setEventosActivos(data.eventosActivos)
      setComidaNido(data.comidaNido)
      setSegundosCorrida(data.segundos)
      setDuracionTickMs(data.duracionTickMs)
      if (data.duracionTickMs > 150) {
        setSaturado(true)
      } else if (data.duracionTickMs < 100) {
        setSaturado(false)
      }
    })

    return () => {
      clearInterval(intervalMetricas)
      clearInterval(timerInterval)
      socket.disconnect()
    }
  }, [])

  // HU22: Buffer de muestras temporales en cliente para exportacion local de reportes
  const historicoMuestrasRef = useRef([])

  useEffect(() => {
    const timer = setInterval(() => {
      const espTotal = infraestructura?.espectadoresPorReplica?.reduce((s, r) => s + (r.espectadores || 0), 0) || 0
      historicoMuestrasRef.current.push({
        fecha_utc: new Date().toISOString(),
        tiempo_segundos: segundosCorrida,
        agentes_activos: agentes.length,
        espectadores_activos: espTotal,
        replicas_decision: infraestructura?.replicasDecision ?? 1,
        replicas_difusion: infraestructura?.replicasDifusion ?? 1,
        latencia_tick_ms: duracionTickMs,
        tps: Number(tps.toFixed(1)),
      })
      if (historicoMuestrasRef.current.length > 3600) {
        historicoMuestrasRef.current.shift()
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [segundosCorrida, agentes.length, infraestructura, duracionTickMs, tps])

  const exportarReporte = async (formato = 'csv') => {
    try {
      const res = await fetch(`/api/metricas/reporte?formato=${formato}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_escalamiento_${Date.now()}.${formato}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        avisar(`Reporte ${formato.toUpperCase()} descargado exitosamente`)
        return
      }
    } catch (_) {}

    // Fallback: generar archivo desde las muestras registradas en la sesion actual del navegador
    const muestras = historicoMuestrasRef.current
    if (!muestras.length) {
      avisar('Sin datos para exportar aun')
      return
    }

    let contenido = ''
    let mime = 'text/csv'
    if (formato === 'json') {
      contenido = JSON.stringify(muestras, null, 2)
      mime = 'application/json'
    } else {
      const columnas = [
        'fecha_utc',
        'tiempo_segundos',
        'agentes_activos',
        'espectadores_activos',
        'replicas_decision',
        'replicas_difusion',
        'latencia_tick_ms',
        'tps',
      ]
      const filas = [columnas.join(',')]
      for (const m of muestras) {
        filas.push([
          m.fecha_utc,
          m.tiempo_segundos,
          m.agentes_activos,
          m.espectadores_activos,
          m.replicas_decision,
          m.replicas_difusion,
          m.latencia_tick_ms,
          m.tps,
        ].join(','))
      }
      contenido = filas.join('\n') + '\n'
    }

    const blob = new Blob([contenido], { type: `${mime};charset=utf-8;` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_escalamiento_${Date.now()}.${formato}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    avisar(`Reporte ${formato.toUpperCase()} descargado localmente`)
  }

  const avisar = (texto) => {
    setFeedbackEvento(texto)
    setTimeout(() => setFeedbackEvento(''), 4000)
  }

  const cambiarCarga = (ruta, cantidad) => {
    fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    })
      .then(r => {
        if (!r.ok) throw new Error()
      })
      .catch(() => avisar('No se pudo cambiar la carga: el servidor no responde'))
  }

  // HU15, HU16, HU17: el servidor decide el cooldown; un fallo no lo arranca
  const dispararEvento = (tipo, setCooldown, mensaje) => {
    fetch(`/api/eventos/${tipo}`, { method: 'POST' })
      .then(async r => {
        if (!r.ok && r.status !== 429) throw new Error()
        const d = await r.json()
        setCooldown(d.cooldownSegundos)
        avisar(r.ok ? mensaje : `Otro usuario ya lo disparó: espera ${d.cooldownSegundos} s`)
      })
      .catch(() => avisar('No se pudo disparar el evento: el servidor no responde'))
  }

  const segundosRestantes = (tipo) => {
    const ticks = eventosActivos.filter(ev => ev.tipo === tipo).map(ev => ev.ticksRestantes)
    return ticks.length ? Math.ceil(Math.max(...ticks) / TICKS_POR_SEGUNDO) : 0
  }
  const segundosSequia = segundosRestantes('sequia')
  const segundosDepredador = segundosRestantes('depredador')
  const calorForzado = agentes.length > UMBRAL_AGREGADO
  const modoCalor = calorElegido || calorForzado

  return (
    <div className="app-viewport">
      <div className="alertas">
        {/* Banner de alerta reactiva de saturacion (HU12) */}
        {saturado && (
          <div className="alerta-saturacion-banner" role="alert">
            <span className="alerta-icono">!</span>
            <div className="alerta-texto">
              <strong>ALERTA: SISTEMA SATURADO</strong>
              <span>Tiempo de cálculo del tick: {duracionTickMs} ms. La alerta se despeja por debajo de 100 ms.</span>
            </div>
          </div>
        )}

        {/* Banners de eventos activos (HU15, HU16) */}
        {segundosSequia > 0 && (
          <div className="alerta-evento-banner sequia" role="status">
            Sequía activa ({segundosSequia} s): las hormigas salen de la zona
          </div>
        )}
        {segundosDepredador > 0 && (
          <div className="alerta-evento-banner depredador" role="status">
            Depredador activo ({segundosDepredador} s): persigue y captura hormigas fuera del nido
          </div>
        )}

        {/* Resultado de la ultima accion del usuario */}
        {feedbackEvento && (
          <div className="alerta-evento-banner" role="status">{feedbackEvento}</div>
        )}
      </div>

      {/* Canvas del mundo 1000x1000 interactivo (fullscreen) */}
      <MapaEcosistema
        agentes={agentes}
        recursos={recursos}
        depredadores={depredadores}
        eventosActivos={eventosActivos}
        ancho={1000}
        alto={1000}
        modoCalor={modoCalor}
        onCameraChange={setCamInfo}
      />

      {/* Capa de interfaces flotantes (HUD) */}
      <div className="hud-container">
        {/* HUD Superior Izquierdo: Estado del Sistema */}
        <div className="hud-top-left hud-interactive">
          <LuminousCard>
            <div className="hud-header">
              <span className="hud-title">Estado del Sistema</span>
              <span className={`hud-badge ${status.difusion === 'Online' ? '' : 'offline'}`}>
                {status.difusion === 'Online' ? 'EN VIVO' : 'OFFLINE'}
              </span>
            </div>

            <ContadorAgentes agentes={agentes.length} />

            <div className="hud-row">
              <span>Comida en nido:</span>
              <span className="val texto-recurso">{comidaNido} uds</span>
            </div>
            <div className="hud-row">
              <span>Recursos visibles:</span>
              <span className="val">{recursos.length}</span>
            </div>
            <div className="hud-row">
              <span>Depredadores activos:</span>
              <span className="val">{depredadores.length}</span>
            </div>
            <div className="hud-row hud-row-extra">
              <span>Modo del mapa:</span>
              <span className="val">
                {calorForzado ? 'Calor (automático)' : modoCalor ? 'Calor' : 'Puntos'}
              </span>
            </div>
            <div className="hud-row">
              <span>Tiempo de corrida:</span>
              <span className="val">{formatearTiempo(segundosCorrida)}</span>
            </div>
            <div className="hud-row">
              <span>Cadencia real (TPS):</span>
              <span className="val">{tps.toFixed(1)} tps</span>
            </div>
            <div className="hud-row hud-row-extra">
              <span>Tick del motor:</span>
              <span className="val">{tick}</span>
            </div>
            <div className="hud-row">
              <span>Latencia cálculo tick:</span>
              <span className={`val ${saturado ? 'texto-alerta' : ''}`}>{duracionTickMs} ms</span>
            </div>
            <div className="hud-row hud-row-extra">
              <span>Cámara central:</span>
              <span className="val">[{camInfo.cellX}, {camInfo.cellY}]</span>
            </div>
            <div className="hud-row hud-row-extra">
              <span>Escala (Zoom):</span>
              <span className="val">{camInfo.zoom}x</span>
            </div>
            <div className="hud-row hud-row-extra">
              <span>Acceso espectador:</span>
              <span className="val">Público (sin login)</span>
            </div>
          </LuminousCard>
        </div>

        {/* HUD Superior Derecho: Orquestacion Kubernetes */}
        <div className="hud-top-right hud-interactive">
          <LuminousCard>
            <div className="hud-header">
              <span className="hud-title">Kubernetes (HPA)</span>
              <span className="hud-badge hud-row-extra">Namespace: default</span>
            </div>

            <MetricasInfraestructura {...infraestructura} />

            <div className="hud-row">
              <span>Motor del mundo:</span>
              <span className="val">1 réplica (fija)</span>
            </div>
            <div className="hud-row">
              <span>Difusión (WS):</span>
              <span className="val">{status.difusion}</span>
            </div>
            <div className="hud-row">
              <span>Eventos (REST):</span>
              <span className="val">{status.eventos}</span>
            </div>
            <div className="hud-export-actions" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
              <button
                className="btn-exportar"
                onClick={() => exportarReporte('csv')}
                title="Descargar métricas de la prueba de escalamiento en formato tabular CSV (HU22)"
              >
                📥 Exportar CSV
              </button>
              <button
                className="btn-exportar"
                onClick={() => exportarReporte('json')}
                title="Descargar métricas de la prueba en formato JSON (HU22)"
              >
                📄 JSON
              </button>
            </div>
          </LuminousCard>
        </div>

        {/* Panel Inferior Central: Controles de Carga y Eventos */}
        <div className="hud-bottom-center hud-interactive">
          <LuminousCard className="action-bar">
            <NeumorphicButton onClick={() => cambiarCarga('/api/admin/spawn', 100)} variant="spawn">
              <span>Inyectar carga</span>
              <span className="btn-subtext">(+100 agentes)</span>
            </NeumorphicButton>
            <NeumorphicButton onClick={() => cambiarCarga('/api/admin/spawn', 1000)} variant="spawn">
              <span>Inyectar carga</span>
              <span className="btn-subtext">(+1000 agentes)</span>
            </NeumorphicButton>
            <NeumorphicButton onClick={() => cambiarCarga('/api/admin/purge', 100)} variant="purge">
              <span>Purgar carga</span>
              <span className="btn-subtext">(-100 agentes)</span>
            </NeumorphicButton>
            <NeumorphicButton
              onClick={() => setCalorElegido(c => !c)}
              disabled={calorForzado}
              title={calorForzado ? `Con más de ${UMBRAL_AGREGADO} agentes el mapa queda en calor` : 'Cambia cómo se dibujan las hormigas'}
            >
              <span>Ver mapa</span>
              <span className="btn-subtext">{modoCalor ? 'como puntos' : 'de calor'}</span>
            </NeumorphicButton>
            <NeumorphicButton
              onClick={() => dispararEvento('sequia', setCooldownSequia, 'Sequía aplicada: recursos eliminados en la zona')}
              cooldown={cooldownSequia}
              cooldownMax={10}
              variant="sequia"
              nombre="Sequía"
              title="Elimina la comida de una zona (HU15)"
            >
              <span>Generar</span>
              <span className="btn-subtext">Sequía</span>
            </NeumorphicButton>
            <NeumorphicButton
              onClick={() => dispararEvento('depredador', setCooldownDepredador, 'Depredador invocado: las hormigas cercanas huyen')}
              cooldown={cooldownDepredador}
              cooldownMax={8}
              variant="depredador"
              nombre="Depredador"
              title="Invoca un depredador temporal (HU16)"
            >
              <span>Invocar</span>
              <span className="btn-subtext">Depredador</span>
            </NeumorphicButton>
            <NeumorphicButton
              onClick={() => dispararEvento('abundancia', setCooldownAbundancia, 'Abundancia inyectada: el terreno tiene comida nueva')}
              cooldown={cooldownAbundancia}
              cooldownMax={6}
              variant="abundancia"
              nombre="Recursos"
              title="Genera parches de comida (HU17)"
            >
              <span>Brote</span>
              <span className="btn-subtext">Recursos</span>
            </NeumorphicButton>
          </LuminousCard>
          <div className="hud-tip hud-row-extra">
            Arrastra para mover la cámara | Rueda del mouse para zoom
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
