import { useState } from 'react'
import Icon from './Icon'

// Removable ingredient chip. `flag` shows an amber dot + makes the whole chip
// a button (used for "needs a date" items on the baseline scan).
export function Chip({ label, flag = false, onRemove, onFlagClick }) {
  return (
    <span className={`chip ${flag ? 'chip--flag' : ''}`}>
      {flag && (
        <button type="button" className="chip__flag" onClick={onFlagClick} aria-label={`Add a date for ${label}`}>
          <span className="status-dot status-dot--warn" style={{ width: 7, height: 7 }} />
        </button>
      )}
      <span className="chip__label">{label}</span>
      {onRemove && (
        <button type="button" className="chip__x" onClick={onRemove} aria-label={`Remove ${label}`}>
          <Icon name="close" size={13} />
        </button>
      )}
    </span>
  )
}

// Ghost chip that expands into an inline text input.
export function AddChip({ onAdd, placeholder = 'Add item' }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const commit = () => {
    const v = text.trim()
    if (v) onAdd(v)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="chip chip--add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} />
        <span>Add</span>
      </button>
    )
  }

  return (
    <span className="chip chip--input">
      <input
        autoFocus
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setText('')
            setOpen(false)
          }
        }}
        onBlur={commit}
      />
    </span>
  )
}
