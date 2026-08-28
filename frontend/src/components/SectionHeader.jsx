// Bold section label with a small metadata tag pinned to the opposite edge.

export default function SectionHeader({ label, tag, tone = 'muted', action }) {
  return (
    <div className="section-header">
      <h2 className="section-header__label">{label}</h2>
      {tag != null && <span className={`section-header__tag section-header__tag--${tone}`}>{tag}</span>}
      {action}
    </div>
  )
}
