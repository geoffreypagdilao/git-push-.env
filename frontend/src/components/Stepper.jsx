import Icon from './Icon'

// Compact quantity control.
export default function Stepper({ value, unit, onChange, step = 1, min = 0 }) {
  const set = (next) => onChange(Math.max(min, Math.round(next * 100) / 100))
  return (
    <div className="stepper">
      <button type="button" className="stepper__btn" onClick={() => set(value - step)} aria-label="Decrease">
        <Icon name="minus" size={16} />
      </button>
      <span className="stepper__value">
        {Number.isInteger(value) ? value : value.toFixed(1)}
        {unit ? <span className="stepper__unit"> {unit}</span> : null}
      </span>
      <button type="button" className="stepper__btn" onClick={() => set(value + step)} aria-label="Increase">
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
