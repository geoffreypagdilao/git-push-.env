import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { useNav } from '../lib/navigation'

// One L-shaped bracket. Rotated into each corner of the viewfinder.
function Corner({ where }) {
  return (
    <svg className={`camscan__corner camscan__corner--${where}`} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M4 16 V8 Q4 4 8 4 H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Full-screen camera scanning UI. `status` is the detection-state label shown
 * in the bottom pill and is meant to be swapped as the capture flow advances
 * ("Detecting fridge…" → "Fridge detected" → "Capturing…" → "Analyzing
 * contents…"). The camera feed is a placeholder <video> for now.
 */
export function CameraScanner({ status = 'Detecting fridge…', onBack, onMenu }) {
  const videoRef = useRef(null)

  useEffect(() => {
    // TODO: wire up the real feed here —
    //   navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    //     .then((stream) => { videoRef.current.srcObject = stream })
    // and stop the tracks on cleanup. Until then the element stays black.
    const el = videoRef.current
    return () => {
      const stream = el?.srcObject
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="camscan">
      <video
        ref={videoRef}
        className="camscan__feed"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="camscan__vignette" />

      <div className="camscan__bar">
        <button type="button" className="camscan__icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="arrow-left" size={22} />
        </button>
        <button type="button" className="camscan__icon-btn" aria-label="More options" onClick={onMenu}>
          <Icon name="more" size={22} />
        </button>
      </div>

      <div className="camscan__viewfinder">
        <Corner where="tl" />
        <Corner where="tr" />
        <Corner where="bl" />
        <Corner where="br" />
      </div>

      <div className="camscan__status" role="status" aria-live="polite">
        <span className="camscan__pulse" aria-hidden="true" />
        {status}
      </div>
    </div>
  )
}

// Scripted capture sequence for the onboarding baseline scan. Steps through
// the detection states, then hands off to the detected-ingredients review.
const SEQUENCE = [
  { status: 'Detecting fridge…', hold: 1600 },
  { status: 'Fridge detected', hold: 1100 },
  { status: 'Capturing…', hold: 1100 },
  { status: 'Analyzing contents…', hold: 1900 },
]

export default function BaselineScan() {
  const nav = useNav()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= SEQUENCE.length) {
      const t = setTimeout(() => nav.replace('detected'), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), SEQUENCE[step].hold)
    return () => clearTimeout(t)
  }, [step, nav])

  const status = SEQUENCE[Math.min(step, SEQUENCE.length - 1)].status

  return <CameraScanner status={status} onBack={() => nav.replace('onboarding')} />
}
