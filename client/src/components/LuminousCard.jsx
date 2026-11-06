import './LuminousCard.css'

export default function LuminousCard({ children, className = '', active = false }) {
  return (
    <div className={`luminous-card ${active ? 'active' : ''} ${className}`.trim()}>
      <div className="luminous-content">
        {children}
      </div>
    </div>
  )
}
