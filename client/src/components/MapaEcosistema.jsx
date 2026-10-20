import { useEffect, useRef, useState, useCallback } from 'react'
import './MapaEcosistema.css'

export default function MapaEcosistema({
  agentes = [],
  ancho = 1000,
  alto = 1000,
  onCameraChange,
}) {
  const canvasRef = useRef(null)

  // Estado de cámara y zoom
  const [zoom, setZoom] = useState(0.5)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasCenteredRef = useRef(false)

  const BASE_CELL = 12

  // Redimensionar canvas al tamaño exacto de la ventana
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Centrar el mundo de 1000x1000 en el primer renderizado
    if (!hasCenteredRef.current) {
      const initialZoom = 0.5
      const worldPx = ancho * BASE_CELL * initialZoom
      const cx = (window.innerWidth - worldPx) / 2
      const cy = (window.innerHeight - worldPx) / 2
      setCamera({ x: cx, y: cy })
      setZoom(initialZoom)
      hasCenteredRef.current = true
    }
  }, [ancho])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  // Notificar al HUD sobre coordenadas de cámara
  useEffect(() => {
    if (onCameraChange && canvasRef.current) {
      const cellSize = BASE_CELL * zoom
      const centerX = Math.round((-camera.x + window.innerWidth / 2) / cellSize)
      const centerY = Math.round((-camera.y + window.innerHeight / 2) / cellSize)
      onCameraChange({
        cellX: Math.max(0, Math.min(ancho, centerX)),
        cellY: Math.max(0, Math.min(alto, centerY)),
        zoom: zoom.toFixed(2),
      })
    }
  }, [camera, zoom, ancho, alto, onCameraChange])

  // Control de arrastre (Pan)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return // Solo clic izquierdo
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX - camera.x,
      y: e.clientY - camera.y,
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setCamera({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Control de zoom con rueda del mouse
  const handleWheel = (e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
    const newZoom = Math.min(Math.max(0.08, zoom * zoomFactor), 5.0)

    const mouseX = e.clientX
    const mouseY = e.clientY

    // Zoom centrado hacia la posicion del cursor
    const newCamX = mouseX - (mouseX - camera.x) * (newZoom / zoom)
    const newCamY = mouseY - (mouseY - camera.y) * (newZoom / zoom)

    setZoom(newZoom)
    setCamera({ x: newCamX, y: newCamY })
  }

  // Bucle de renderizado en Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cw = canvas.width
    const ch = canvas.height

    const cellSize = BASE_CELL * zoom

    // Fondo oscuro espacial
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, cw, ch)

    // Limites visibles de cuadricula en pantalla (culling)
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

    // Dibujar cuadriculas del tamano de los puntos solo cuando el zoom lo permita
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

    // Borde delimitador del mundo 1000x1000
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.strokeRect(worldScreenX, worldScreenY, worldScreenW, worldScreenH)

    // Renderizar hormigas
    ctx.fillStyle = '#e94560'
    const antRadius = Math.max(2, cellSize * 0.4)

    for (let i = 0; i < agentes.length; i++) {
      const a = agentes[i]
      const px = camera.x + a.x * cellSize + cellSize / 2
      const py = camera.y + a.y * cellSize + cellSize / 2

      // Dibujar solo si esta dentro de la pantalla
      if (px >= -antRadius && px <= cw + antRadius && py >= -antRadius && py <= ch + antRadius) {
        ctx.beginPath()
        ctx.arc(px, py, antRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [agentes, camera, zoom, ancho, alto])

  return (
    <canvas
      ref={canvasRef}
      className={`mapa-canvas-full ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  )
}
