import { useEffect, useRef, useState, useCallback } from 'react'
import './MapaEcosistema.css'

// Mismo nido que el motor
const NIDO = { x: 500, y: 500, radio: 20 }
// Tamano de celda (px) desde el que se ven los numeros de hormigas por casilla
const CELDA_MIN_NUMERO = 9

export default function MapaEcosistema({
  agentes = [],
  recursos = [],
  depredadores = [],
  eventosActivos = [],
  ancho = 1000,
  alto = 1000,
  modoCalor = false,
  onCameraChange,
}) {
  const canvasRef = useRef(null)

  // Referencias mutables para el bucle de eventos y zoom no pasivo
  const zoomRef = useRef(0.5)
  const cameraRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasCenteredRef = useRef(false)

  // Umbral y listas en refs para bucle de renderizado a 60fps
  const modoCalorRef = useRef(modoCalor)
  useEffect(() => {
    modoCalorRef.current = modoCalor
  }, [modoCalor])

  const agentesListRef = useRef(agentes)
  useEffect(() => {
    agentesListRef.current = agentes
  }, [agentes])

  const recursosListRef = useRef(recursos)
  useEffect(() => {
    recursosListRef.current = recursos
  }, [recursos])

  const depredadoresListRef = useRef(depredadores)
  useEffect(() => {
    depredadoresListRef.current = depredadores
  }, [depredadores])

  const eventosListRef = useRef(eventosActivos)
  useEffect(() => {
    eventosListRef.current = eventosActivos
  }, [eventosActivos])

  // Estado minimo para re-render de UI
  const [, setRenderTrigger] = useState(0)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const animAgentesRef = useRef(new Map())

  const BASE_CELL = 12

  // Cada borde del mundo puede entrar hasta un cuarto de pantalla; si el mundo es chico, queda centrado
  const limitarCamara = useCallback((x, y) => {
    const eje = (v, vista, celdas) => {
      const lado = celdas * BASE_CELL * zoomRef.current
      const min = vista * 0.75 - lado
      const max = vista * 0.25
      return min > max ? (vista - lado) / 2 : Math.min(max, Math.max(min, v))
    }
    return { x: eje(x, window.innerWidth, ancho), y: eje(y, window.innerHeight, alto) }
  }, [ancho, alto])

  // Sincronizar objetivos de animacion cuando llegan nuevos datos del servidor
  useEffect(() => {
    if (modoCalorRef.current) {
      animAgentesRef.current.clear()
      return
    }

    const currentMap = animAgentesRef.current
    const activeIds = new Set()
    const lista = Array.isArray(agentes) ? agentes : []

    for (let i = 0; i < lista.length; i++) {
      const a = lista[i]
      if (!a) continue
      activeIds.add(a.id)
      const p = currentMap.get(a.id)
      if (!p) {
        currentMap.set(a.id, { x: a.x, y: a.y, targetX: a.x, targetY: a.y })
      } else {
        p.targetX = a.x
        p.targetY = a.y
      }
    }

    if (currentMap.size > lista.length) {
      for (const id of currentMap.keys()) {
        if (!activeIds.has(id)) {
          currentMap.delete(id)
        }
      }
    }
  }, [agentes])

  // Centrar el mundo al inicio
  const centerWorld = useCallback(() => {
    const initialZoom = 0.5
    const worldPx = ancho * BASE_CELL * initialZoom
    const cx = (window.innerWidth - worldPx) / 2
    const cy = (window.innerHeight - worldPx) / 2

    zoomRef.current = initialZoom
    cameraRef.current = { x: cx, y: cy }
    hasCenteredRef.current = true
    setRenderTrigger(n => n + 1)
  }, [ancho])

  // Ajuste de tamano de canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    if (!hasCenteredRef.current) {
      centerWorld()
    } else {
      cameraRef.current = limitarCamara(cameraRef.current.x, cameraRef.current.y)
      setRenderTrigger(n => n + 1)
    }
  }, [centerWorld, limitarCamara])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  // Notificar al HUD sobre coordenadas y zoom
  const notifyHUD = useCallback(() => {
    if (onCameraChange && canvasRef.current) {
      const cellSize = BASE_CELL * zoomRef.current
      const centerX = Math.round((-cameraRef.current.x + window.innerWidth / 2) / cellSize)
      const centerY = Math.round((-cameraRef.current.y + window.innerHeight / 2) / cellSize)
      onCameraChange({
        cellX: Math.max(0, Math.min(ancho, centerX)),
        cellY: Math.max(0, Math.min(alto, centerY)),
        zoom: zoomRef.current.toFixed(2),
      })
    }
  }, [onCameraChange, ancho, alto])

  // Zoom alrededor de un punto de la pantalla (rueda del mouse o pellizco)
  const zoomEn = useCallback((factor, x, y) => {
    const zoomAnterior = zoomRef.current
    const zoom = Math.min(Math.max(0.08, zoomAnterior * factor), 5.0)
    const cam = cameraRef.current
    zoomRef.current = zoom
    cameraRef.current = limitarCamara(
      x - (x - cam.x) * (zoom / zoomAnterior),
      y - (y - cam.y) * (zoom / zoomAnterior),
    )
    notifyHUD()
    setRenderTrigger(n => n + 1)
  }, [limitarCamara, notifyHUD])

  // Manejo de Zoom no pasivo
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNative = (e) => {
      e.preventDefault()
      e.stopPropagation()
      zoomEn(e.deltaY < 0 ? 1.15 : 0.85, e.clientX, e.clientY)
    }

    canvas.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelNative)
  }, [zoomEn])

  // Dedos (o mouse) apoyados sobre el mapa y ultimo pellizco medido
  const punterosRef = useRef(new Map())
  const pellizcoRef = useRef(null)

  const empezarArrastre = (x, y) => {
    isDraggingRef.current = true
    setIsDraggingState(true)
    dragStartRef.current = { x: x - cameraRef.current.x, y: y - cameraRef.current.y }
  }

  // Control de arrastre (Pan) y pellizco (zoom)
  const handlePointerDown = (e) => {
    if (e.button !== 0) return
    e.target.setPointerCapture(e.pointerId)
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punterosRef.current.size === 1) empezarArrastre(e.clientX, e.clientY)
  }

  const handlePointerMove = (e) => {
    const punteros = punterosRef.current
    if (!punteros.has(e.pointerId)) return
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (punteros.size >= 2) {
      const [a, b] = [...punteros.values()]
      const actual = {
        distancia: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      }
      const previo = pellizcoRef.current
      pellizcoRef.current = actual
      if (!previo || previo.distancia === 0) return
      // Mover con el centro de los dedos y acercar segun cuanto se separan
      const cam = cameraRef.current
      cameraRef.current = { x: cam.x + actual.x - previo.x, y: cam.y + actual.y - previo.y }
      zoomEn(actual.distancia / previo.distancia, actual.x, actual.y)
      return
    }

    if (!isDraggingRef.current) return
    cameraRef.current = limitarCamara(
      e.clientX - dragStartRef.current.x,
      e.clientY - dragStartRef.current.y,
    )
    notifyHUD()
    setRenderTrigger(n => n + 1)
  }

  const handlePointerUp = (e) => {
    const punteros = punterosRef.current
    punteros.delete(e.pointerId)
    pellizcoRef.current = null
    try {
      e.target.releasePointerCapture(e.pointerId)
    } catch { /* ya estaba liberado */ }
    if (punteros.size === 1) {
      // Queda un dedo: sigue arrastrando desde donde esta, sin saltos
      const [resto] = punteros.values()
      empezarArrastre(resto.x, resto.y)
    } else if (punteros.size === 0 && isDraggingRef.current) {
      isDraggingRef.current = false
      setIsDraggingState(false)
    }
  }

  // Bucle de animacion continuo a 60fps
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId

    const render = () => {
      const cw = canvas.width
      const ch = canvas.height
      const zoom = zoomRef.current
      const camera = cameraRef.current
      const cellSize = BASE_CELL * zoom

      const esModoAgregado = modoCalorRef.current
      const conNumero = cellSize >= CELDA_MIN_NUMERO

      // 1. Interpolacion suave de posiciones (Lerp)
      if (!esModoAgregado) {
        for (const p of animAgentesRef.current.values()) {
          p.x += (p.targetX - p.x) * 0.18
          p.y += (p.targetY - p.y) * 0.18
        }
      }

      // 2. Fondo del viewport
      ctx.fillStyle = '#0f1013'
      ctx.fillRect(0, 0, cw, ch)

      // Culling: rangos de celdas visibles en pantalla
      const startCol = Math.max(0, Math.floor(-camera.x / cellSize))
      const endCol = Math.min(ancho, Math.ceil((cw - camera.x) / cellSize))
      const startRow = Math.max(0, Math.floor(-camera.y / cellSize))
      const endRow = Math.min(alto, Math.ceil((ch - camera.y) / cellSize))

      // Fondo del mundo 1000x1000
      const worldScreenX = camera.x
      const worldScreenY = camera.y
      const worldScreenW = ancho * cellSize
      const worldScreenH = alto * cellSize

      ctx.fillStyle = '#141519'
      ctx.fillRect(worldScreenX, worldScreenY, worldScreenW, worldScreenH)

      // Pinta un cuadrado de `radio` celdas alrededor de (x, y)
      const cuadrado = (x, y, radio, relleno, borde, punteado = []) => {
        const px = camera.x + (x - radio) * cellSize
        const py = camera.y + (y - radio) * cellSize
        const lado = (2 * radio + 1) * cellSize
        ctx.fillStyle = relleno
        ctx.fillRect(px, py, lado, lado)
        ctx.strokeStyle = borde
        ctx.lineWidth = 1.5
        ctx.setLineDash(punteado)
        ctx.strokeRect(px, py, lado, lado)
        ctx.setLineDash([])
      }

      cuadrado(NIDO.x, NIDO.y, NIDO.radio, 'rgba(35, 36, 40, 0.85)', '#C7E4E8')

      // Cuadricula
      if (cellSize >= 6) {
        ctx.strokeStyle = 'rgba(147, 159, 161, 0.12)'
        ctx.lineWidth = 0.75
        ctx.beginPath()

        for (let col = startCol; col <= endCol; col++) {
          const x = camera.x + col * cellSize
          ctx.moveTo(x, camera.y + startRow * cellSize)
          ctx.lineTo(x, camera.y + endRow * cellSize)
        }
        for (let row = startRow; row <= endRow; row++) {
          const y = camera.y + row * cellSize
          ctx.moveTo(camera.x + startCol * cellSize, y)
          ctx.lineTo(camera.x + endCol * cellSize, y)
        }
        ctx.stroke()
      }

      // Borde delimitador del mundo
      ctx.strokeStyle = '#C7E4E8'
      ctx.lineWidth = 2
      ctx.strokeRect(worldScreenX, worldScreenY, worldScreenW, worldScreenH)

      // Zonas de eventos activas (HU15 y HU17)
      for (const ev of eventosListRef.current || []) {
        if (ev.tipo === 'sequia') {
          cuadrado(ev.x, ev.y, ev.radio, 'rgba(212, 154, 85, 0.12)', 'rgba(212, 154, 85, 0.75)', [8, 5])
        } else if (ev.tipo === 'abundancia') {
          cuadrado(ev.x, ev.y, ev.radio, 'rgba(52, 211, 153, 0.08)', 'rgba(52, 211, 153, 0.7)', [6, 4])
        }
      }

      // Comida (HU17): un cuadrado por parche, con minimo visible al alejar el zoom
      for (const r of recursosListRef.current || []) {
        if (r.x >= startCol && r.x <= endCol && r.y >= startRow && r.y <= endRow) {
          const ave = r.tipo === 'ave'
          const ladoComida = ave ? Math.max(9, cellSize * 2) : Math.max(3, cellSize * 0.8)
          ctx.fillStyle = ave ? '#fbbf24' : '#34d399'
          ctx.fillRect(
            camera.x + (r.x + 0.5) * cellSize - ladoComida / 2,
            camera.y + (r.y + 0.5) * cellSize - ladoComida / 2,
            ladoComida,
            ladoComida,
          )
        }
      }

      // Depredadores (HU16): zona de panico y cuerpo cuadrados
      for (const dep of depredadoresListRef.current || []) {
        cuadrado(dep.x, dep.y, dep.radioAmenaza, 'rgba(225, 29, 72, 0.12)', 'rgba(225, 29, 72, 0.55)', [4, 4])
        const ladoDep = Math.max(7, cellSize * 1.2)
        ctx.fillStyle = '#e11d48'
        ctx.fillRect(
          camera.x + (dep.x + 0.5) * cellSize - ladoDep / 2,
          camera.y + (dep.y + 0.5) * cellSize - ladoDep / 2,
          ladoDep,
          ladoDep,
        )
      }

      // 3. Renderizado de entidades: Agregado vs Detallado (HU13)
      // El numero de hormigas por casilla va en la esquina inferior derecha
      ctx.font = `bold ${Math.min(11, Math.max(7, Math.floor(cellSize * 0.6)))}px ui-monospace, Consolas, monospace`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'

      if (esModoAgregado) {
        const densidadPorCelda = new Map()
        const rawAgentes = Array.isArray(agentesListRef.current) ? agentesListRef.current : []

        for (let i = 0; i < rawAgentes.length; i++) {
          const a = rawAgentes[i]
          const cx = Math.round(a.x)
          const cy = Math.round(a.y)

          if (cx >= startCol && cx <= endCol && cy >= startRow && cy <= endRow) {
            const key = `${cx},${cy}`
            densidadPorCelda.set(key, (densidadPorCelda.get(key) || 0) + 1)
          }
        }

        for (const [key, count] of densidadPorCelda.entries()) {
          const [cx, cy] = key.split(',').map(Number)
          const screenX = camera.x + cx * cellSize
          const screenY = camera.y + cy * cellSize

          if (count >= 10) {
            ctx.fillStyle = '#FFFFFF'
          } else if (count >= 5) {
            ctx.fillStyle = 'rgba(225, 238, 243, 0.9)'
          } else if (count >= 2) {
            ctx.fillStyle = 'rgba(199, 228, 232, 0.65)'
          } else {
            ctx.fillStyle = 'rgba(199, 228, 232, 0.35)'
          }

          ctx.fillRect(screenX, screenY, cellSize, cellSize)

          if (conNumero) {
            // Oscuro sobre los cuadros claros, claro sobre los tenues
            ctx.fillStyle = count >= 2 ? '#0f1013' : '#FFFFFF'
            ctx.fillText(count, screenX + cellSize - 1, screenY + cellSize)
          }
        }
      } else {
        ctx.fillStyle = '#E1EEF3'
        const antRadius = Math.max(2, cellSize * 0.4)
        const cellCounts = conNumero ? new Map() : null

        ctx.beginPath()

        for (const p of animAgentesRef.current.values()) {
          const px = camera.x + p.x * cellSize + cellSize / 2
          const py = camera.y + p.y * cellSize + cellSize / 2

          if (px >= -antRadius && px <= cw + antRadius && py >= -antRadius && py <= ch + antRadius) {
            ctx.moveTo(px + antRadius, py)
            ctx.arc(px, py, antRadius, 0, Math.PI * 2)

            if (cellCounts) {
              const cx = Math.round(p.targetX)
              const cy = Math.round(p.targetY)
              const key = `${cx},${cy}`
              cellCounts.set(key, (cellCounts.get(key) || 0) + 1)
            }
          }
        }

        ctx.fill()

        if (cellCounts) {
          ctx.fillStyle = '#C7E4E8'

          for (const [key, count] of cellCounts.entries()) {
            if (count > 1) {
              const [cx, cy] = key.split(',').map(Number)
              const textX = camera.x + (cx + 1) * cellSize - 2
              const textY = camera.y + (cy + 1) * cellSize - 1
              ctx.fillText(count, textX, textY)
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [ancho, alto])

  return (
    <canvas
      ref={canvasRef}
      className={`mapa-canvas-full ${isDraggingState ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  )
}
