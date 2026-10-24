import './ContadorAgentes.css'

export default function ContadorAgentes({ agentes }) {
  return (
    <div className="hud-agentes-embedded" aria-live="polite">
      <span>Agentes activos:</span>
      <strong>{Number.isInteger(agentes) ? agentes.toLocaleString() : '—'}</strong>
    </div>
  )
}
