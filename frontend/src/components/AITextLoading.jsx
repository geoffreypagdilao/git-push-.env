import { useEffect, useState } from 'react'

// Cycling shimmer-text loader. Plain CSS, no animation library — this
// codebase doesn't use one, and a single cycling <span> doesn't need one.
const DEFAULT_TEXTS = ['Checking your fridge…', 'Weighing what expires soonest…', 'Cooking up ideas…', 'Almost there…']

export default function AITextLoading({ texts = DEFAULT_TEXTS, interval = 1600 }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % texts.length), interval)
    return () => clearInterval(timer)
  }, [interval, texts.length])

  return (
    <div className="ai-loading">
      <span key={i} className="ai-loading__text">
        {texts[i]}
      </span>
    </div>
  )
}
