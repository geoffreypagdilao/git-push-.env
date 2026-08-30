import { useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import Button from '../components/Button'
import Sheet from '../components/Sheet'
import SectionHeader from '../components/SectionHeader'
import ItemRow from '../components/ItemRow'
import { useNav } from '../lib/navigation'
import { useStore } from '../lib/store'
import { stickerFor } from '../lib/mockData'
import {
  statusOf,
  isUseSoon,
  predictedRunOut,
  daysUntilEmpty,
  daysUntilExpiry,
  formatQty,
  relativeAdded,
  freshnessLabel,
  plural,
  groupByCategory,
} from '../lib/inventory'

const urgency = (i) => Math.min(daysUntilEmpty(i), daysUntilExpiry(i) ?? Infinity)

// Compact "time left" for the countdown row — the sooner of expiry or
// running out, as 4h / 2d / 1w.
function countdownLabel(item) {
  const d = urgency(item)
  if (!isFinite(d)) return '—'
  if (d < 1) return `${Math.max(1, Math.round(d * 24))}h`
  if (d < 7) return `${Math.max(1, Math.round(d))}d`
  return `${Math.round(d / 7)}w`
}

export default function MyFridge({ justOnboarded = false }) {
  const nav = useNav()
  const { state, dispatch } = useStore()
  const [detail, setDetail] = useState(null)
  const [settings, setSettings] = useState(false)
  const [showPayoff, setShowPayoff] = useState(justOnboarded)

  // The camera only sees the fridge, so the app tracks fresh items only for now.
  const items = useMemo(
    () => state.inventory.filter((i) => i.section === 'fresh'),
    [state.inventory],
  )
  // Soonest-to-go items, for the expiry countdown. Falls back from the strict
  // "use soon" set to the 4 nearest so the list always has some depth.
  const useSoon = useMemo(() => {
    const ranked = items
      .filter((i) => isFinite(urgency(i)))
      .sort((a, b) => urgency(a) - urgency(b))
    const alerting = ranked.filter(isUseSoon)
    return (alerting.length >= 4 ? alerting : ranked).slice(0, 4)
  }, [items])
  const groups = useMemo(() => groupByCategory(items), [items])

  return (
    <div className="screen">
      <TopBar
        wordmark
        right={
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettings(true)}
            aria-label="Settings"
          >
            <Icon name="sliders" size={20} />
          </button>
        }
      />

      <div className="screen__scroll">
        <div className="fridge__head">
          <h1 className="display">My Fridge</h1>
          <p className="meta fridge__updated">
            {plural(items.length, 'item')} · updated 2m ago
          </p>
        </div>

        {showPayoff && (
          <div className="payoff">
            <Icon name="bell" size={20} className="payoff__icon" />
            <div className="payoff__text">
              <strong>You’re all set.</strong>
              <span>yoink! will remind you before anything runs out or spoils.</span>
            </div>
            <button
              type="button"
              className="payoff__close"
              onClick={() => setShowPayoff(false)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {useSoon.length > 0 && (
          <>
            <SectionHeader label="Expiry Countdown" />
            <div className="countdown">
              {useSoon.map((item) => {
                const status = statusOf(item)
                const sticker = stickerFor(item.name)
                const urgent = status !== 'good'
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="countdown__row"
                    onClick={() => nav.push('recipe', { seedItem: item.name })}
                  >
                    <span className="countdown__icon">
                      {sticker ? (
                        <img src={`${import.meta.env.BASE_URL}stickers/${sticker}`} alt="" />
                      ) : (
                        <Icon name="leaf" size={22} />
                      )}
                    </span>
                    <span className="countdown__body">
                      <span className="countdown__name">{item.name}</span>
                      <span className="countdown__cat">{item.category}</span>
                    </span>
                    {urgent && (
                      <span className={`countdown__bang countdown__bang--${status}`} aria-hidden="true">
                        !
                      </span>
                    )}
                    <span className={`countdown__badge countdown__badge--${status}`}>
                      {countdownLabel(item)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="cat-grid">
          {groups.map(([category, items]) => (
            <div key={category} className="cat-col">
              <SectionHeader
                label={category}
                tag={category === 'Vegetables' ? null : `${items.length}`}
                action={
                  category === 'Vegetables' ? (
                    <button
                      type="button"
                      className="section-header__link"
                      onClick={() => nav.push('recipe', { seedItem: items[0]?.name })}
                    >
                      Recipe ideas <Icon name="chevron-right" size={14} />
                    </button>
                  ) : null
                }
              />
              <div className="cat-group">
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} onOpen={setDetail} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="muted-note">Nothing here yet — yoink! adds items as they go in.</p>
        )}
      </div>

      {/* item detail */}
      <Sheet open={!!detail} title={detail?.name || ''} onClose={() => setDetail(null)}>
        {detail && <ItemDetail item={detail} dispatch={dispatch} onClose={() => setDetail(null)} nav={nav} />}
      </Sheet>

      {/* settings */}
      <Sheet open={settings} title="Settings" onClose={() => setSettings(false)}>
        <div className="set-row">
          <div className="set-row__text">
            <strong>Autopilot ordering</strong>
            <span>{state.autonomy === 'auto' ? 'yoink! places orders for you' : 'yoink! suggests, you confirm'}</span>
          </div>
          <button
            type="button"
            className={`toggle ${state.autonomy === 'auto' ? 'is-on' : ''}`}
            role="switch"
            aria-checked={state.autonomy === 'auto'}
            aria-label="Autopilot ordering"
            onClick={() =>
              dispatch({ type: 'SET_AUTONOMY', mode: state.autonomy === 'auto' ? 'suggest' : 'auto' })
            }
          >
            <span className="toggle__knob" />
          </button>
        </div>
        <div className="set-row">
          <div className="set-row__text">
            <strong>Door-close capture</strong>
            <span>Camera fires when the fridge closes</span>
          </div>
          <button type="button" className="toggle is-on" role="switch" aria-checked="true" aria-label="Door-close capture">
            <span className="toggle__knob" />
          </button>
        </div>
        <div style={{ marginTop: 18 }}>
          <Button
            variant="ghost"
            full
            onClick={() => {
              dispatch({ type: 'RESET_DEMO' })
              setSettings(false)
              nav.reset('onboarding')
            }}
          >
            <Icon name="refresh" size={17} />
            Reset demo
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function ItemDetail({ item, dispatch, onClose, nav }) {
  const runOut = predictedRunOut(item)
  const status = statusOf(item)
  const fresh = freshnessLabel(item)

  // Reconstruct a 7-day stock trend from qty + learned pace (roughly one
  // restock's worth ago), normalised to the tallest bar.
  const peak = item.qty + (item.perWeek || item.qty * 0.5)
  const bars = Array.from({ length: 7 }, (_, i) => {
    const q = peak - (peak - item.qty) * (i / 6)
    return Math.max(10, (q / peak) * 100)
  })

  return (
    <>
      <div className="spark" aria-hidden="true">
        {bars.map((h, i) => (
          <span
            key={i}
            className={i === bars.length - 1 ? `spark__now spark__now--${status}` : ''}
            style={{ height: `${Math.min(100, h)}%` }}
          />
        ))}
      </div>
      <p className="meta" style={{ marginBottom: 10 }}>
        Stock trend · last 7 days
      </p>

      <div className="detail-stat">
        <span className="detail-stat__k">In stock</span>
        <span className="detail-stat__v">{formatQty(item)}</span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__k">Learned pace</span>
        <span className="detail-stat__v">~{item.perWeek} {item.unit}/week</span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__k">Predicted to run out</span>
        <span className="detail-stat__v">
          {runOut ? runOut.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
        </span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__k">Use by</span>
        <span className="detail-stat__v">
          {item.expiryDate
            ? new Date(item.expiryDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
              (fresh ? ` · ${fresh}` : '')
            : 'not set'}
        </span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__k">Added</span>
        <span className="detail-stat__v">{relativeAdded(item.addedDaysAgo)}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button
          variant="ghost"
          full
          onClick={() => {
            dispatch({ type: 'ADD_STAPLE', name: item.name })
            onClose()
          }}
        >
          <Icon name="list" size={17} />
          Add to list
        </Button>
        <Button
          full
          onClick={() => {
            onClose()
            nav.push('recipe', { seedItem: item.name })
          }}
        >
          <Icon name="recipe" size={17} />
          Cook it
        </Button>
      </div>
    </>
  )
}
