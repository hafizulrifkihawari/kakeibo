import { describe, expect, it } from 'vitest'
import { perKgText, priceTrend, priceVerdict, statsFor, storeStats, type Purchase } from '../products'

/** A purchase priced per piece, or per 100 g when `g` is given. */
const buy = (date: string, store: string, pc: number, g?: number): Purchase => ({
  expenseId: date,
  date,
  store,
  linePrice: pc,
  qty: 1,
  unit: 'pc',
  pack: null,
  prices: g === undefined ? { pc } : { pc, g },
  basis: g === undefined ? 'pc' : 'g',
  price: g ?? pc,
})

// Newest first, as the server sorts them.
const history = [
  buy('2026-11-01', 'OK', 200),
  buy('2026-10-20', 'ライフ', 240),
  buy('2026-10-05', 'OK', 180),
  buy('2026-09-15', 'ライフ', 260),
  buy('2026-09-01', 'OK', 200),
  buy('2026-06-01', 'ライフ', 100),
]

describe('statsFor', () => {
  it('gives the average of all purchases and of the newest 5', () => {
    const s = statsFor(history, 'pc')!
    expect(s).toMatchObject({ count: 6, lastPrice: 200, minPrice: 100 })
    expect(s.avgPrice).toBe(197)
    expect(s.recentAvg).toBe(216)
  })

  it('skips purchases that do not compare by the basis', () => {
    const s = statsFor([buy('2026-11-01', 'OK', 300, 150), buy('2026-10-01', 'OK', 280)], 'g')!
    expect(s).toMatchObject({ count: 1, avgPrice: 150, recentAvg: 150 })
  })
})

describe('priceVerdict', () => {
  const stats = { count: 5, minPrice: 180, recentAvg: 200 }

  it('is new with fewer than 2 purchases', () => {
    expect(priceVerdict(100, { ...stats, count: 1 }).level).toBe('new')
  })

  it('is lowest under the cheapest price', () => {
    expect(priceVerdict(170, stats)).toEqual({ level: 'lowest', pct: -15 })
  })

  it('is good at 10% or more under the usual price', () => {
    expect(priceVerdict(180, stats)).toEqual({ level: 'good', pct: -10 })
  })

  it('is high at 10% or more over the usual price', () => {
    expect(priceVerdict(220, stats)).toEqual({ level: 'high', pct: 10 })
    expect(priceVerdict(219, stats).level).toBe('normal')
  })

  it('is normal near the usual price', () => {
    expect(priceVerdict(205, stats)).toEqual({ level: 'normal', pct: 3 })
  })
})

describe('storeStats', () => {
  it('groups by store, cheapest average first', () => {
    expect(storeStats(history, 'pc')).toEqual([
      { store: 'OK', count: 3, min: 180, avg: 193, last: 200, lastDate: '2026-11-01' },
      { store: 'ライフ', count: 3, min: 100, avg: 200, last: 240, lastDate: '2026-10-20' },
    ])
  })
})

describe('priceTrend', () => {
  it('compares the last 3 months with the 3 months before', () => {
    // Sep–Nov: 200, 240, 180, 260, 200 = 216. Jun–Aug: 100.
    expect(priceTrend(history, 'pc', '2026-11-05')).toBe(116)
  })

  it('is null when a window has no purchase', () => {
    expect(priceTrend(history.slice(0, 5), 'pc', '2026-11-05')).toBeNull()
    expect(priceTrend(history, 'pc', '2027-06-01')).toBeNull()
  })

  it('handles a window across the new year', () => {
    const list = [buy('2027-01-10', 'OK', 110), buy('2026-09-10', 'OK', 100)]
    expect(priceTrend(list, 'pc', '2027-01-15')).toBe(10)
  })
})

describe('perKgText', () => {
  it('shows a price per 100 g as yen per kg', () => {
    expect(perKgText(133, 'g')).toBe('¥1,330/kg')
    expect(perKgText(25, 'ml')).toBe('¥250/L')
    expect(perKgText(200, 'pc')).toBeNull()
  })
})
