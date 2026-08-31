// Thin wrapper over the /icons.svg sprite. `name` is the symbol id without
// the `i-` prefix, e.g. <Icon name="fridge" />.

export default function Icon({ name, size = 22, className = '', ...rest }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  )
}
