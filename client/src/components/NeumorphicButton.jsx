import './NeumorphicButton.css'

export default function NeumorphicButton({
  children,
  onClick,
  disabled = false,
  cooldown = 0,
  cooldownMax = 10,
  className = '',
  title = '',
  type = 'button',
  variant = '',
  nombre = '',
}) {
  const isCooldown = typeof cooldown === 'number' && cooldown > 0
  const variantClass = variant ? `btn-${variant}` : ''
  const cdClass = isCooldown ? 'is-cooldown' : ''
  const disabledClass = disabled && !isCooldown ? 'btn-disabled' : ''
  const durationSec = Number(cooldownMax) > 0 ? Number(cooldownMax) : 10

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isCooldown}
      className={`neumorphic-button ${variantClass} ${cdClass} ${disabledClass} ${className}`.trim()}
      title={title}
    >
      {isCooldown ? (
        <div className="btn-cd-wrapper">
          <div className="ld-fill">
            <div
              key={`cd-drain-${durationSec}`}
              className="ld-fill-drain"
              style={{ animationDuration: `${durationSec}s` }}
            >
              <div className="ld-fill-wave" />
            </div>
            <span className="ld-fill-num">{cooldown}s</span>
          </div>
          {nombre && <span className="btn-subtext">{nombre}</span>}
        </div>
      ) : (
        children
      )}
    </button>
  )
}
