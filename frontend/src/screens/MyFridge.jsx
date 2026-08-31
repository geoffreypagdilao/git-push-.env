import { useEffect, useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import Icon from '../components/Icon'
import Button from '../components/Button'
import Sheet from '../components/Sheet'
import SectionHeader from '../components/SectionHeader'
import ItemRow from '../components/ItemRow'
import { useNav } from '../lib/navigation'
import { useStore } from '../lib/store'
import { stickerFor, categoryLabel } from '../lib/mockData'
import * as api from '../lib/api'
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
  estimateConsumption,
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
  const { state, dispatch, addStaple, runAgentSweep } = useStore()
  const [detail, setDetail] = useState(null)
  const [settings, setSettings] = useState(false)
  const [showPayoff, setShowPayoff] = useState(justOnboarded)
  const [agentBusy, setAgentBusy] = useState(false)
  const [agentResult, setAgentResult] = useState(null)

  const items = state.inventory
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

  const runCheck = async () => {
    setAgentBusy(true)
    setAgentResult(null)
    try {
      const result = await runAgentSweep(state.autonomy)
      setAgentResult({ message: result.final_message, error: !!result.error })
    } catch (err) {
      setAgentResult({ message: err.message, error: true })
    } finally {
      setAgentBusy(false)
    }
  }

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
          <p className="meta fridge__updated">{plural(items.length, 'item')} · from the tracked fridge</p>
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

        <Button variant="ghost" full onClick={runCheck} disabled={agentBusy}>
          <Icon name="sparkle" size={17} />
          {agentBusy ? 'Checking your fridge…' : 'Run agent check now'}
        </Button>

        {agentResult && (
          <div className="payoff" style={{ marginTop: 10 }}>
            <Icon name={agentResult.error ? 'close' : 'sparkle'} size={20} className="payoff__icon" />
            <div className="payoff__text">
              <strong>{agentResult.error ? 'Something went wrong' : 'Agent check complete'}</strong>
              <span>{agentResult.message}</span>
            </div>
            <button
              type="button"
              className="payoff__close"
              onClick={() => setAgentResult(null)}
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
                      <span className="countdown__cat">{categoryLabel(item.category)}</span>
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
          {groups.map(([category, items], idx) => (
            <div key={category} className="cat-col">
              <SectionHeader
                label={categoryLabel(category)}
                tag={`${items.length}`}
                action={
                  idx === 0 ? (
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

        {items.length === 0 && state.inventoryLoaded && (
          <p className="muted-note">Nothing tracked yet — yoink! adds items as the fridge camera detects them.</p>
        )}
      </div>

      {/* item detail */}
      <Sheet open={!!detail} title={detail?.name || ''} onClose={() => setDetail(null)}>
        {detail && (
          <ItemDetail item={detail} addStaple={addStaple} onClose={() => setDetail(null)} nav={nav} />
        )}
      </Sheet>

      {/* settings */}
      <Sheet open={settings} title="Settings" onClose={() => setSettings(false)}>
        <div className="set-row">
          <div className="set-row__text">
            <strong>Autopilot ordering</strong>
            <span>{state.autonomy === 'autopilot' ? 'yoink! places orders for you' : 'yoink! suggests, you confirm'}</span>
          </div>
          <button
            type="button"
            className={`toggle ${state.autonomy === 'autopilot' ? 'is-on' : ''}`}
            role="switch"
            aria-checked={state.autonomy === 'autopilot'}
            aria-label="Autopilot ordering"
            onClick={() =>
              dispatch({ type: 'SET_AUTONOMY', mode: state.autonomy === 'autopilot' ? 'suggest' : 'autopilot' })
            }
          >
            <span className="toggle__knob" />
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function ItemDetail({ item, addStaple, onClose, nav }) {
  const [consumption, setConsumption] = useState(null)
  const [loadingLog, setLoadingLog] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingLog(true)
    api
      .fetchItemLog(item.id)
      .then((log) => {
        if (!cancelled) setConsumption(estimateConsumption(log))
      })
      .catch(() => {
        if (!cancelled) setConsumption(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingLog(false)
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  const enriched = useMemo(() => ({ ...item, perWeek: consumption?.perWeek ?? null }), [item, consumption])
  const runOut = predictedRunOut(enriched)
  const status = statusOf(enriched)
  const fresh = freshnessLabel(enriched)

  return (
    <>
      <div className="detail-stat">
        <span className="detail-stat__k">In stock</span>
        <span className="detail-stat__v">{formatQty(item)}</span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__k">Learned pace</span>
        <span className="detail-stat__v">
          {loadingLog
            ? 'loading…'
            : consumption
              ? `~${consumption.perWeek.toFixed(1)} ${item.unit}/week`
              : 'not enough data yet'}
        </span>
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
        <span className="detail-stat__k">First tracked</span>
        <span className="detail-stat__v">{relativeAdded(item.addedDaysAgo)}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button
          variant="ghost"
          full
          onClick={() => {
            addStaple(item.name)
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
