import { useEffect, useRef, useState, useCallback } from 'react'
import './MapaEcosistema.css'

export default function MapaEcosistema({
  agentes = [],
  ancho = 1000,
  alto = 1000,
  onCameraChange,
}) {
  const canvasRef = useRef(null)

  // Referencias mutables para el bucle de eventos y zoom no pasivo
  const zoomRef = useRef(0.5)
  const cameraRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasCenteredRef = useRef(false)

  // Estado minimo para re-render de UI
  const [, setRenderTrigger] = useState(0)
  const [isDraggingState, setIsDraggingState] = useState(false)

  const BASE_CELL = 12

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
      setRenderTrigger(n => n + 1)
    }
  }, [centerWorld])

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

  // Manejo de Zoom no pasivo (bloquea el zoom del navegador en la pagina)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNative = (e) => {
      // Detener cualquier zoom o scroll del navegador web
      e.preventDefault()
      e.stopPropagation()

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
      const newZoom = Math.min(Math.max(0.08, zoomRef.current * zoomFactor), 5.0)

      const mouseX = e.clientX
      const mouseY = e.clientY

      const currentCam = cameraRef.current
      const currentZoom = zoomRef.current

      // Zoom centrado en el punto del cursor
      const newCamX = mouseX - (mouseX - currentCam.x) * (newZoom / currentZoom)
      const newCamY = mouseY - (mouseY - currentCam.y) * (newZoom / currentZoom)

      zoomRef.current = newZoom
      cameraRef.current = { x: newCamX, y: newCamY }

      notifyHUD()
      setRenderTrigger(n => n + 1)
    }

    // passive: false es esencial para que preventDefault funcione contra el navegador
    canvas.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelNative)
  }, [notifyHUD])

  // Control de arrastre (Pan)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    setIsDraggingState(true)
    dragStartRef.current = {
      x: e.clientX - cameraRef.current.x,
      y: e.clientY - cameraRef.current.y,
    }
  }

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return
    cameraRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    }
    notifyHUD()
    setRenderTrigger(n => n + 1)
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
    setIsDraggingState(false)
  }

  // Renderizado en Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cw = canvas.width
    const ch = canvas.height

    const zoom = zoomRef.current
    const camera = cameraRef.current
    const cellSize = BASE_CELL * zoom

    // Fondo del viewport
    ctx.fillStyle = '#0b0f19'
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

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(worldScreenX, worldScreenY, worldScreenW, worldScreenH)

    // Nido central (coordenadas 500, 500)
    const nestRadius = 25 * cellSize
    const nestScreenX = camera.x + 500 * cellSize
    const nestScreenY = camera.y + 500 * cellSize

    ctx.beginPath()
    ctx.arc(nestScreenX, nestScreenY, nestRadius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)'
    ctx.fill()
    ctx.strokeStyle = '#0284c7'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Cuadricula del tamano exacto de los puntos (cuando el zoom lo amerita)
    if (cellSize >= 6) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'
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
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.strokeRect(worldScreenX, worldScreenY, worldScreenW, worldScreenH)

    // Dibujar hormigas
    ctx.fillStyle = '#e94560'
    const antRadius = Math.max(2, cellSize * 0.4)

    for (let i = 0; i < agentes.length; i++) {
      const a = agentes[i]
      const px = camera.x + a.x * cellSize + cellSize / 2
      const py = camera.y + a.y * cellSize + cellSize / 2

      if (px >= -antRadius && px <= cw + antRadius && py >= -antRadius && py <= ch + antRadius) {
        ctx.beginPath()
        ctx.arc(px, py, antRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [agentes, ancho, alto])

  return (
    <canvas
      ref={canvasRef}
      className={`mapa-canvas-full ${isDraggingState ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  )
}
