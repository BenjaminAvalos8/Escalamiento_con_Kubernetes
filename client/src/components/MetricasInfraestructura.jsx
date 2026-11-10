import './MetricasInfraestructura.css'

export default function MetricasInfraestructura({ replicasDecision, replicasDifusion, espectadoresPorReplica = [] }) {
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
      {espectadoresPorReplica.length > 0 && (
        <ul className="hud-infra-replicas" aria-label="Espectadores por réplica de difusión">
          {espectadoresPorReplica.map(({ replica, espectadores }) => (
            <li key={replica} title={replica}>
              <progress
                aria-label={`Espectadores en ${replica}`}
                value={espectadores}
                max={Math.max(25, espectadores)}
              />
              <span>{replica.split('-').at(-1)} · {espectadores}/25 espect.</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
