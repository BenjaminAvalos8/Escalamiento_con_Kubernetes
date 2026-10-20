import { useEffect, useRef } from 'react'
import './MapaEcosistema.css'

export default function MapaEcosistema({ agentes = [], ancho = 100, alto = 100 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cw = canvas.width
    const ch = canvas.height

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, cw, ch)

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    const stepX = cw / 10
    const stepY = ch / 10
    for (let x = 0; x <= cw; x += stepX) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, ch)
      ctx.stroke()
    }
    for (let y = 0; y <= ch; y += stepY) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(cw, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#e94560'
    for (const a of agentes) {
      const px = (a.x / ancho) * cw
      const py = (a.y / alto) * ch
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [agentes, ancho, alto])

  return (
    <div className="mapa-contenedor">
      <canvas ref={canvasRef} width={600} height={600} className="mapa-canvas" />
    </div>
  )
}
