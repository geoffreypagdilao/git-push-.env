import Icon from './Icon'
import StatusDot from './StatusDot'
import DepletionMeter from './DepletionMeter'
import { formatQty, statusOf, stockFraction, freshnessLabel, stockLabel } from '../lib/inventory'

// One inventory line inside a category group.
export default function ItemRow({ item, onOpen }) {
  const status = statusOf(item)
  const sub = freshnessLabel(item) || stockLabel(item)

  return (
    <button type="button" className="item-row" onClick={() => onOpen(item)}>
      <StatusDot status={status} />
      <span className="item-row__main">
        <span className="item-row__name">{item.name}</span>
        <span className="item-row__sub">
          {formatQty(item)} · {sub}
        </span>
        <DepletionMeter fraction={stockFraction(item)} status={status} />
      </span>
      <Icon name="chevron-right" size={18} className="item-row__chev" />
    </button>
  )
}
