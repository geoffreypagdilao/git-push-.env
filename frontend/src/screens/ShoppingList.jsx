import { useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import Icon from '../components/Icon'
import SectionHeader from '../components/SectionHeader'
import { AddChip } from '../components/Chip'
import { useStore } from '../lib/store'
import { stickerFor } from '../lib/mockData'
import { plural, relativeAdded } from '../lib/inventory'

function StickerTile({ name, children }) {
  const sticker = stickerFor(name)
  return (
    <span className="shop-row__icon">
      {sticker ? (
        <img src={`${import.meta.env.BASE_URL}stickers/${sticker}`} alt="" />
      ) : (
        <Icon name="leaf" size={20} />
      )}
      {children}
    </span>
  )
}

function relativeSince(iso) {
  if (!iso) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  return relativeAdded(days)
}

// The backend fills store_link on every new row, but rows staged before that
// existed (and rows handed back by its duplicate check) can still be null —
// rebuild the same search URL so the link always goes somewhere useful.
function storeLinkFor(entry) {
  return entry.store_link || `https://www.fairprice.com.sg/search?query=${encodeURIComponent(entry.item_name)}`
}

function PendingRow({ entry, onPurchase, onDismiss }) {
  return (
    <div className="shop-row">
      <StickerTile name={entry.item_name} />
      <div className="shop-row__body">
        <div className="shop-row__name">{entry.item_name}</div>
        <div className="shop-row__why">Staged {relativeSince(entry.staged_at)}</div>
      </div>
      <div className="shop-row__actions">
        <a
          className="btn btn--ghost shop-row__buy"
          href={storeLinkFor(entry)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Find ${entry.item_name} at FairPrice`}
        >
          Buy
        </a>
        <Button variant="ghost" onClick={onPurchase}>
          Purchased
        </Button>
        <button type="button" className="shop-row__dismiss" aria-label={`Remove ${entry.item_name}`} onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}

export default function ShoppingList() {
  const { state, addStaple, dismissShopping, setShoppingStatus } = useStore()
  const [showAllPurchased, setShowAllPurchased] = useState(false)

  const pending = useMemo(() => state.shopping.filter((s) => s.status === 'pending'), [state.shopping])
  const purchased = useMemo(
    () =>
      state.shopping
        .filter((s) => s.status === 'purchased')
        .sort((a, b) => new Date(b.confirmed_at || 0) - new Date(a.confirmed_at || 0)),
    [state.shopping],
  )
  const purchasedShown = showAllPurchased ? purchased : purchased.slice(0, 3)

  return (
    <div className="screen">
      <TopBar wordmark />

      <div className="screen__scroll">
        <h1 className="display">Shopping list</h1>
        <p className="meta" style={{ marginTop: 8 }}>
          {plural(pending.length, 'item')} to buy
        </p>

        <div className="shop-cols">
          <div className="shop-col">
            <SectionHeader label="To buy" action={<AddChip onAdd={addStaple} placeholder="Add an item" />} />
            {pending.length > 0 ? (
              <div className="shop-block">
                {pending.map((e) => (
                  <PendingRow
                    key={e.id}
                    entry={e}
                    onPurchase={() => setShoppingStatus(e.id, 'purchased')}
                    onDismiss={() => dismissShopping(e.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="muted-note">List’s clear. yoink! refills it as things run low.</p>
            )}
          </div>
        </div>

        {purchased.length > 0 && (
          <>
            <SectionHeader label="Purchased" tag={`${purchased.length}`} />
            <div className="shop-block">
              {purchasedShown.map((e) => (
                <div className="shop-row shop-row--sent" key={e.id}>
                  <StickerTile name={e.item_name}>
                    <span className="shop-row__done">
                      <Icon name="check" size={11} />
                    </span>
                  </StickerTile>
                  <div className="shop-row__body">
                    <div className="shop-row__name">{e.item_name}</div>
                    <div className="shop-row__why">Bought {relativeSince(e.confirmed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            {purchased.length > 3 && (
              <button
                type="button"
                className="section-header__link"
                style={{ marginTop: 8 }}
                onClick={() => setShowAllPurchased((v) => !v)}
              >
                {showAllPurchased ? 'Show less' : `Show all ${purchased.length}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
