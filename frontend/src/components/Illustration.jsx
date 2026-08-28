// Flat line-art scenes drawn inline so the app stays asset-free. Strokes use
// currentColor / tokens; one accent mark per scene, nothing decorative.

const stroke = {
  fill: 'none',
  stroke: 'var(--ink)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function FridgeScene() {
  return (
    <svg viewBox="0 0 220 190" role="img" aria-label="A fridge">
      <rect x="74" y="24" width="72" height="142" rx="12" {...stroke} />
      <path d="M74 78h72" {...stroke} />
      <path d="M92 44v14M92 96v20" {...stroke} />
      <circle cx="176" cy="52" r="9" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d="M176 52v-16M176 52l13 9" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CameraScene() {
  return (
    <svg viewBox="0 0 220 190" role="img" aria-label="A camera watching a fridge door">
      <rect x="30" y="34" width="58" height="120" rx="10" {...stroke} />
      <path d="M30 88h58" {...stroke} />
      <path d="M46 52v12M46 104v16" {...stroke} />
      <rect x="128" y="70" width="62" height="44" rx="9" {...stroke} />
      <circle cx="159" cy="92" r="12" {...stroke} />
      <path d="M128 82l-22-9v38l22-9" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function ScanScene() {
  return (
    <svg viewBox="0 0 220 190" role="img" aria-label="A fridge being scanned">
      <rect x="70" y="26" width="80" height="138" rx="12" {...stroke} />
      <path d="M70 84h80" {...stroke} />
      <path d="M60 60h100" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 60l14-10M60 60l14 10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="96" cy="118" r="4" {...stroke} />
      <circle cx="124" cy="104" r="4" {...stroke} />
      <circle cx="112" cy="140" r="4" {...stroke} />
    </svg>
  )
}

export function BellScene() {
  return (
    <svg viewBox="0 0 220 190" role="img" aria-label="A low-stock reminder">
      <path d="M78 132c9-9 13-22 13-41v-9a28 28 0 0 1 56 0v9c0 19 4 32 13 41z" {...stroke} />
      <path d="M104 146a15 15 0 0 0 30 0" {...stroke} />
      <circle cx="150" cy="52" r="13" fill="var(--accent)" />
    </svg>
  )
}

export function DishScene() {
  return (
    <svg viewBox="0 0 300 200" role="img" aria-label="A bowl of food">
      {/* steam */}
      <path d="M132 44c-6 8 6 14 0 22M150 38c-6 8 6 14 0 22M168 44c-6 8 6 14 0 22"
        fill="none" stroke="var(--fill-3)" strokeWidth="3" strokeLinecap="round" />
      {/* bowl */}
      <path d="M64 104h172c-6 42-40 66-86 66s-80-24-86-66Z" {...stroke} />
      <ellipse cx="150" cy="104" rx="86" ry="20" {...stroke} />
      {/* noodle swirl */}
      <path d="M104 104c0-16 14-28 30-28s28 10 28 22-10 20-20 20-16-8-16-15 6-12 12-12"
        fill="none" stroke="var(--fill-3)" strokeWidth="3" strokeLinecap="round" />
      {/* garnish leaf */}
      <path d="M188 96c8-2 16 0 22 8-10 4-19 2-22-8Z" fill="none" stroke="var(--good)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  )
}
