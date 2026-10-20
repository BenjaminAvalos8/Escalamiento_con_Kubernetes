import './ContadorAgentes.css'

export default function ContadorAgentes({ agentes }) {
  return (
    <div className="hud-agentes" aria-live="polite">
      <div className="hud-titulo">Estado del Sistema</div>
      <div className="hud-fila">
        <span>Agentes:</span>
        <strong>{Number.isInteger(agentes) ? agentes : '—'}</strong>
      </div>
    </div>
  )
}