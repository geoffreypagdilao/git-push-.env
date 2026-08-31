// Pill segmented control. `options` = [{ value, label, note?, disabled? }].

export default function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className={`segmented segmented--${size}`} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            className={`segmented__opt ${active ? 'is-active' : ''}`}
            onClick={() => !opt.disabled && onChange(opt.value)}
          >
            <span className="segmented__label">{opt.label}</span>
            {opt.note && <span className="segmented__note">{opt.note}</span>}
          </button>
        )
      })}
    </div>
  )
}
