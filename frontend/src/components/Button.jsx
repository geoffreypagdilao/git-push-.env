// Pill button. variant: 'primary' (solid blue) | 'ghost' | 'quiet'.

export default function Button({ variant = 'primary', full = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} ${full ? 'btn--full' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
