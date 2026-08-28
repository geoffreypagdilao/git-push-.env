import { useMemo } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import Icon from '../components/Icon'
import Segmented from '../components/Segmented'
import SectionHeader from '../components/SectionHeader'
import StatusDot from '../components/StatusDot'
import Stepper from '../components/Stepper'
import { useStore } from '../lib/store'
import { CARTS } from '../lib/mockData'
import { plural } from '../lib/inventory'

const CART_HINT = {
  redmart: 'RedMart delivers across Singapore, usually same day.',
  amazon: 'Ships on your Amazon Prime membership.',
  mock: 'Demo checkout — nothing is actually ordered.',
  instacart: 'Instacart only covers the US and Canada.',
}

function ShopRow({ entry, dispatch, auto }) {
  return (
    <div className="shop-row">
      {auto ? <StatusDot status={entry.urgency || 'warn'} /> : <span className="shop-row__spacer" />}
      <div className="shop-row__body">
        <div className="shop-row__name">{entry.name}</div>
        <div className={`shop-row__why ${auto ? 'shop-row__why--auto' : ''}`}>
          {auto && <Icon name="sparkle" size={13} />}
          {auto ? entry.reason : 'Always on hand'}
        </div>
      </div>
      <div className="shop-row__actions">
        <Stepper
          value={entry.qty}
          unit={entry.unit}
          onChange={(qty) => dispatch({ type: 'SET_SHOPPING_QTY', id: entry.id, qty })}
        />
        <button
          type="button"
          className="shop-row__dismiss"
          aria-label={`Remove ${entry.name}`}
          onClick={() => dispatch({ type: 'DISMISS_SHOPPING', id: entry.id })}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}

export default function ShoppingList() {
  const { state, dispatch } = useStore()

  const pending = useMemo(() => state.shopping.filter((s) => s.status === 'pending'), [state.shopping])
  const inCart = useMemo(() => state.shopping.filter((s) => s.status === 'in_cart'), [state.shopping])
  const auto = pending.filter((s) => s.source === 'auto')
  const manual = pending.filter((s) => s.source === 'manual')

  const cart = CARTS.find((c) => c.id === state.cart) || CARTS[1]
  const sentCart = CARTS.find((c) => c.id === state.lastSent?.cart)

  return (
    <div className="screen">
      <TopBar wordmark />

      <div className="screen__scroll">
        <h1 className="display">Shopping list</h1>
        <p className="meta" style={{ marginTop: 8 }}>
          {pending.length === 0 && inCart.length > 0
            ? `${plural(inCart.length, 'item')} on the way to ${sentCart?.label || cart.label}`
            : `${auto.length} auto-added · ${plural(manual.length, 'staple')}`}
        </p>

        <div className="shop-cols">
          {auto.length > 0 && (
            <div className="shop-col">
              <SectionHeader label="Added automatically" tag="low or out" tone="bad" />
              <div className="shop-block">
                {auto.map((e) => (
                  <ShopRow key={e.id} entry={e} dispatch={dispatch} auto />
                ))}
              </div>
            </div>
          )}
        </div>

        {inCart.length > 0 && (
          <>
            <SectionHeader label="On its way" tag={`to ${sentCart?.label || cart.label}`} />
            <div className="shop-block">
              {inCart.map((e) => (
                <div className="shop-row shop-row--sent" key={e.id}>
                  <span className="shop-row__done">
                    <Icon name="check" size={12} />
                  </span>
                  <div className="shop-row__body">
                    <div className="shop-row__name">{e.name}</div>
                    <div className="shop-row__why">
                      {e.qty} {e.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {pending.length === 0 && inCart.length === 0 && (
          <p className="muted-note">List’s clear. yoink! refills it as things run low.</p>
        )}

        {pending.length > 0 && (
          <div className="cart-picker">
            <SectionHeader label="Send to" />
            <Segmented
              size="sm"
              value={state.cart}
              onChange={(id) => dispatch({ type: 'SET_CART', cart: id })}
              options={CARTS.map((c) => ({ value: c.id, label: c.label, disabled: c.disabled }))}
            />
            <p className="cart-hint">
              <Icon name={state.cart === 'instacart' ? 'close' : 'check'} size={13} />
              {CART_HINT[state.cart]}
            </p>
          </div>
        )}

        <div className="shop-send">
          {pending.length === 0 && state.lastSent ? (
            <div className="sent-pill">
              <Icon name="check" size={16} />
              Sent {plural(state.lastSent.count, 'item')} to {sentCart?.label}
            </div>
          ) : (
            <Button full disabled={pending.length === 0} onClick={() => dispatch({ type: 'SEND_CART' })}>
              Send {plural(pending.length, 'item')} to {cart.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
