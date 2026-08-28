// Semantic status indicator. The ONLY place colour earns its keep.

const LABELS = {
  good: 'In stock',
  warn: 'Running low or use soon',
  bad: 'Out or spoiling',
}

export default function StatusDot({ status = 'good', size = 9 }) {
  return (
    <span
      className={`status-dot status-dot--${status}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={LABELS[status] || LABELS.good}
    />
  )
}
