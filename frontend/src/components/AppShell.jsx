// Full-bleed responsive shell. The document scrolls; each screen lays out
// its own content column (narrow for long-form, wide for dashboards).

export default function AppShell({ children }) {
  return <div className="app-shell">{children}</div>
}
