import './MetricasInfraestructura.css'

export default function MetricasInfraestructura({ replicasDecision = 1 }) {
  return (
    <div className="hud-infraestructura" aria-live="polite">
      <div className="hud-titulo">Métricas de Infraestructura</div>
      <div className="hud-fila">
        <span>Pods de decisión:</span>
        <strong className="metrica-decision">
          {Number.isInteger(replicasDecision) ? replicasDecision : '—'}
        </strong>
      </div>
    </div>
  )
}
