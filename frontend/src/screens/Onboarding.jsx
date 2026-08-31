import Button from '../components/Button'
import { useNav } from '../lib/navigation'

// Food-photo stickers tossed around the "yoink!" wordmark. top/left are % of
// the collage box, size is px, rot is degrees.
const STICKERS = [
  { src: 'bread.png', top: 34.5, left: 39.5, size: 143, rot: -13 },
  { src: 'cheese.png', top: 26.2, left: 70.5, size: 141, rot: 21 },
  { src: 'tomato.png', top: 39.4, left: 57.7, size: 105, rot: -28 },
  { src: 'avocado.png', top: 70.2, left: 74.9, size: 135, rot: -22 },
  { src: 'lettuce.png', top: 39.9, left: 83, size: 109, rot: 0 },
  { src: 'chili.png', top: 26.1, left: 23.8, size: 93, rot: -2 },
  { src: 'egg.png', top: 57.2, left: 84.6, size: 132, rot: 25 },
  { src: 'brocolli.png', top: 55.3, left: 16.9, size: 115, rot: 28 },
  { src: 'radish.png', top: 69.8, left: 29.9, size: 140, rot: -12 },
  { src: 'tomato.png', top: 60.9, left: 51, size: 99, rot: 9 },
  { src: 'avocado.png', top: 39.5, left: 15.9, size: 94, rot: -29 },
  { src: 'cheese.png', top: 74.8, left: 53, size: 132, rot: 0 },
  { src: 'brocolli.png', top: 20, left: 48.5, size: 105, rot: 20 },
]

export default function Onboarding() {
  const nav = useNav()
  const goToScan = () => nav.replace('scan')

  return (
    <div className="onb">
      <button type="button" className="onb__skip" onClick={goToScan}>
        Skip
      </button>

      <div className="onb__collage">
        {STICKERS.map((s, i) => (
          <img
            key={i}
            className="sticker"
            src={`${import.meta.env.BASE_URL}stickers/${s.src}`}
            alt=""
            aria-hidden="true"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              '--rotation': `${s.rot}deg`,
            }}
          />
        ))}
        <span className="wordmark onb__hero-word">yoink!</span>
      </div>

      <div className="onb__foot">
        <div className="onb__dots">
          <span className="onb__dot is-active" />
          <span className="onb__dot" />
          <span className="onb__dot" />
        </div>
        <Button full onClick={goToScan}>
          Continue
        </Button>
      </div>
    </div>
  )
}
