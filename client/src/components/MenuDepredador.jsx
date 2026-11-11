import { useEffect, useRef, useState } from 'react'
import NeumorphicButton from './NeumorphicButton.jsx'
import './MenuDepredador.css'

// Burbujas en fila sobre el boton; angulo y radio llevan a cada una a su lugar girando alrededor del boton
const OPCIONES = [
  { cantidad: 1, angulo: -130.0, radio: 80.9 },
  { cantidad: 3, angulo: -90.0, radio: 62.0 },
  { cantidad: 5, angulo: -50.0, radio: 80.9 },
]

export default function MenuDepredador({ cooldown = 0, cooldownMax = 8, onElegir }) {
  const [abierto, setAbierto] = useState(false)
  const raizRef = useRef(null)
  const visible = abierto && !(cooldown > 0)

  useEffect(() => {
    if (!visible) return
    // Un clic en cualquier otro lado lo cierra, sin frenar el arrastre del mapa
    const cerrarFuera = (e) => {
      if (!raizRef.current?.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrarFuera)
    return () => document.removeEventListener('pointerdown', cerrarFuera)
  }, [visible])

  return (
    <div ref={raizRef} className={`menu-depredador ${visible ? 'abierto' : ''}`}>
      {OPCIONES.map(({ cantidad, angulo, radio }, i) => (
        <button
          key={cantidad}
          type="button"
          className="burbuja-depredador"
          style={{ '--i': i, '--a': `${angulo}deg`, '--r': `${radio}px` }}
          tabIndex={visible ? 0 : -1}
          aria-hidden={!visible}
          aria-label={`Invocar ${cantidad} ${cantidad === 1 ? 'depredador' : 'depredadores'}`}
          onClick={() => {
            setAbierto(false)
            onElegir(cantidad)
          }}
        >
          {cantidad}
        </button>
      ))}
      <NeumorphicButton
        onClick={() => setAbierto(a => !a)}
        cooldown={cooldown}
        cooldownMax={cooldownMax}
        variant="depredador"
        nombre="Depredador"
        className={visible ? 'is-pulsado' : ''}
        title="Elige cuántos depredadores invocar (HU16)"
      >
        <span>Invocar</span>
        <span className="btn-subtext">Depredador</span>
      </NeumorphicButton>
    </div>
  )
}
