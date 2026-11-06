import './MetricasInfraestructura.css'

export default function MetricasInfraestructura({ replicasDecision = 1, replicasDifusion = 1 }) {
  return (
    <div className="hud-infra-embedded" aria-live="polite">
      <div className="hud-infra-fila">
        <span>Pods Decision:</span>
        <span className="metrica-decision">
          {Number.isInteger(replicasDecision) ? `${replicasDecision} replica(s)` : '—'}
        </span>
      </div>
      <div className="hud-infra-fila" style={{ marginTop: '4px' }}>
        <span>Pods Difusion (WS):</span>
        <span className="metrica-difusion">
          {Number.isInteger(replicasDifusion) ? `${replicasDifusion} replica(s)` : '—'}
        </span>
      </div>
    </div>
  )
}
