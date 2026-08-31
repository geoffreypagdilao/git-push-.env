import TopBar from '../components/TopBar'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { useNav } from '../lib/navigation'
import { useStore } from '../lib/store'
import { DETECTED } from '../lib/mockData'

// Scatter placement for the detected-ingredient stickers — placed by hand
// with the drag editor. left/top are % of the stage, matched by index to
// DETECTED (which is sticker order from mockData).
const SPOTS = [
  { left: 40.5, top: 44.1, size: 118, rot: -7 },
  { left: 42.4, top: 24.6, size: 104, rot: 11 },
  { left: 26.5, top: 37.7, size: 120, rot: 13 },
  { left: 27.6, top: 64.3, size: 134, rot: -13 },
  { left: 72.7, top: 45.3, size: 120, rot: 6 },
  { left: 54.8, top: 53, size: 110, rot: -17 },
  { left: 47.7, top: 73, size: 124, rot: 9 },
  { left: 67.8, top: 65.1, size: 92, rot: 21 },
  { left: 59.8, top: 28.6, size: 108, rot: -5 },
]

const stickerUrl = (file) => `${import.meta.env.BASE_URL}stickers/${file}`

export default function DetectedIngredients() {
  const nav = useNav()
  const { dispatch } = useStore()

  const confirm = () => {
    dispatch({ type: 'CONFIRM_BASELINE' })
    nav.go('fridge', { justOnboarded: true })
  }

  return (
    <div className="screen screen--narrow">
      <TopBar onBack={() => nav.replace('scan')} title="Scan complete" />

      <div className="screen__scroll screen__scroll--cta">
        <p className="lead-count">{DETECTED.length} ingredients detected</p>
        <p className="lead-sub">
          Here’s what yoink! spotted in your fridge. Confirm to start tracking them.
        </p>

        <div className="detected__stage">
          {DETECTED.map((d, i) => {
            const spot = SPOTS[i] || SPOTS[0]
            return (
              <img
                key={d.name}
                className="sticker"
                src={stickerUrl(d.sticker)}
                alt={d.name}
                style={{
                  left: `${spot.left}%`,
                  top: `${spot.top}%`,
                  width: `${spot.size}px`,
                  '--rotation': `${spot.rot}deg`,
                }}
              />
            )
          })}
        </div>

        <ul className="detected__list">
          {DETECTED.map((d) => (
            <li key={d.name}>
              <Icon name="check" size={13} />
              {d.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="cta-bar">
        <Button full onClick={confirm}>
          Continue to my fridge
        </Button>
      </div>
    </div>
  )
}
