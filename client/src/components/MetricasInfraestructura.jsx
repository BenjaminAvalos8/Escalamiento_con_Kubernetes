import './MetricasInfraestructura.css'

export default function MetricasInfraestructura({ replicasDecision = 1 }) {
  return (
    <div className="hud-infra-embedded" aria-live="polite">
      <div className="hud-infra-fila">
        <span>Pods Decision:</span>
        <span className="metrica-decision">
          {Number.isInteger(replicasDecision) ? `${replicasDecision} replica(s)` : '—'}
        </span>
      </div>
    </div>
  )
}
