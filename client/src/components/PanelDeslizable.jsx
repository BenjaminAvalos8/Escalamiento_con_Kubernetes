import { useRef } from 'react'
import './PanelDeslizable.css'

const MOVIL = '(max-width: 760px)'
const ARRASTRE_PARA_CERRAR = 60

// En escritorio es una tarjeta fija; en celular entra desde la derecha y se cierra arrastrandola hacia la derecha.
// `arrastre` lo guarda el padre, para que las pestanas acompanen al panel.
export default function PanelDeslizable({ className = '', abierto, onCerrar, arrastre = 0, onArrastre, children }) {
  const inicioRef = useRef(null)

  const empezar = (e) => {
    if (abierto && window.matchMedia(MOVIL).matches) inicioRef.current = e.clientX
  }
  const mover = (e) => {
    if (inicioRef.current !== null) onArrastre(Math.max(0, e.clientX - inicioRef.current))
  }
  const soltar = () => {
    if (inicioRef.current === null) return
    inicioRef.current = null
    if (arrastre > ARRASTRE_PARA_CERRAR) onCerrar()
    onArrastre(0)
  }

  return (
    <div
      className={`panel-deslizable ${className} ${abierto ? 'abierto' : ''} ${arrastre ? 'arrastrando' : ''}`}
      style={arrastre ? { '--arrastre': `${arrastre}px` } : undefined}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      {children}
      <div className="pista-deslizar" aria-hidden="true">›››</div>
    </div>
  )
}
