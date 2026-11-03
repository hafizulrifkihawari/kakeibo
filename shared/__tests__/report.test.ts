import { describe, expect, it } from 'vitest'
import { projectMonth } from '../budget'
import { buildReport, change, insights, periodRange, storeChain, type ReportRaw } from '../report'

const EMPTY: ReportRaw = { catMonths: [], prevCategories: [], incomeMonths: [], prevIncome: 0, stores: [], kinds: [] }

describe('periodRange', () => {
  it('ends the current month today and compares the same days of last month', () => {
    expect(periodRange({ kind: 'month', ym: '2026-11' }, '2026-11-04')).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-04',
      prevFrom: '2026-10-01',
      prevTo: '2026-10-04',
      months: ['2026-11'],
      days: 4,
    })
  })

  it('uses the whole month for a past month', () => {
    expect(periodRange({ kind: 'month', ym: '2024-02' }, '2026-11-04')).toMatchObject({
      to: '2024-02-29',
      prevFrom: '2024-01-01',
      prevTo: '2024-01-31',
      days: 29,
    })
  })

  it('clamps the compared day to the length of last month', () => {
    expect(periodRange({ kind: 'month', ym: '2026-03' }, '2026-03-31').prevTo).toBe('2026-02-28')
  })

  it('compares the previous January with this January', () => {
    expect(periodRange({ kind: 'month', ym: '2026-01' }, '2026-05-01')).toMatchObject({
      prevFrom: '2025-12-01',
      prevTo: '2025-12-31',
    })
  })

  it('runs the year to date from January 1 to today', () => {
    expect(periodRange({ kind: 'ytd' }, '2026-01-01')).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-01',
      prevFrom: '2025-01-01',
      prevTo: '2025-01-01',
      months: ['2026-01'],
      days: 1,
    })
  })

  it('moves Feb 29 to Feb 28 in the year before', () => {
    expect(periodRange({ kind: 'ytd' }, '2028-02-29').prevTo).toBe('2027-02-28')
  })

  it('shows all 12 months of a past year', () => {
    const r = periodRange({ kind: 'year', year: 2025 }, '2026-11-04')
    expect(r).toMatchObject({ from: '2025-01-01', to: '2025-12-31', prevTo: '2024-12-31', days: 365 })
    expect(r.months).toHaveLength(12)
  })
})

describe('buildReport', () => {
  it('fills empty months and groups store branches into one chain', () => {
    const range = periodRange({ kind: 'ytd' }, '2026-03-10')
    const r = buildReport(range, {
      ...EMPTY,
      catMonths: [
        { ym: '2026-01', id: 'groceries', amount: 30_000 },
        { ym: '2026-03', id: 'dining', amount: 5_000 },
      ],
      prevCategories: [{ id: 'clothing', amount: 2_000 }],
      incomeMonths: [{ ym: '2026-01', source: 'salary', amount: 200_000 }],
      stores: [
        { store: 'ライフ 千本店', amount: 20_000, count: 4 },
        { store: 'ライフ　桂店', amount: 10_000, count: 2 },
      ],
    })
    expect(r.months.map((m) => m.spent)).toEqual([30_000, 0, 5_000])
    expect(r).toMatchObject({ spent: 35_000, income: 200_000, prevSpent: 2_000 })
    expect(r.categories.map((c) => c.id)).toEqual(['groceries', 'dining', 'clothing'])
    expect(r.stores).toEqual([{ store: 'ライフ', amount: 30_000, count: 6 }])
  })
})

describe('insights', () => {
  const range = periodRange({ kind: 'month', ym: '2026-10' }, '2026-11-04')

  it('reports the total change, the largest category moves, and the share of income kept', () => {
    const r = buildReport(range, {
      ...EMPTY,
      catMonths: [
        { ym: '2026-10', id: 'dining', amount: 20_000 },
        { ym: '2026-10', id: 'groceries', amount: 30_000 },
      ],
      prevCategories: [
        { id: 'dining', amount: 10_000 },
        { id: 'groceries', amount: 35_000 },
      ],
      incomeMonths: [{ ym: '2026-10', source: 'salary', amount: 200_000 }],
    })
    const texts = insights(r, [], '2026-11-04').map((i) => i.text)
    expect(texts).toEqual([
      'Spending is up 11% (¥5,000) compared with last month.',
      'Dining went up the most: +¥10,000 (100%).',
      'Groceries went down the most: −¥5,000 (-14%).',
      'You kept 75% of your income (¥150,000).',
    ])
  })

  it('counts the months over budget in a year', () => {
    const r = buildReport(periodRange({ kind: 'ytd' }, '2026-03-10'), {
      ...EMPTY,
      catMonths: [
        { ym: '2026-01', id: 'dining', amount: 12_000 },
        { ym: '2026-02', id: 'dining', amount: 8_000 },
        { ym: '2026-03', id: 'dining', amount: 15_000 },
      ],
    })
    const budgets = [
      { scope: 'total' as const, amount: 10_000, updatedAt: 0 },
      { scope: 'dining' as const, amount: 10_000, updatedAt: 0 },
    ]
    expect(insights(r, budgets, '2026-03-10').map((i) => i.text)).toEqual([
      'You went over the total budget in 2 of 3 months.',
      'Dining went over its budget in 2 months.',
    ])
    // A month with no spending is not counted as a month inside the budget.
    const late = buildReport(periodRange({ kind: 'ytd' }, '2026-03-10'), {
      ...EMPTY,
      catMonths: [{ ym: '2026-03', id: 'dining', amount: 15_000 }],
    })
    expect(insights(late, budgets, '2026-03-10').map((i) => i.text)).toEqual([
      'You went over the total budget in 1 of 1 month.',
      'Dining went over its budget in 1 month.',
    ])
  })

  it('projects the current month against the budget', () => {
    const r = buildReport(periodRange({ kind: 'month', ym: '2026-11' }, '2026-11-10'), {
      ...EMPTY,
      catMonths: [{ ym: '2026-11', id: 'groceries', amount: 20_000 }],
    })
    const [i] = insights(r, [{ scope: 'total', amount: 50_000, updatedAt: 0 }], '2026-11-10')
    expect(i).toMatchObject({ text: 'At this pace the month ends at ¥60,000, ¥10,000 over your budget.', tone: 'bad' })
  })
})

describe('projectMonth', () => {
  it('counts rent one time and spreads only the other spending', () => {
    // ¥62,000 rent plus ¥8,000 in 4 days of a 30-day month.
    expect(projectMonth(70_000, 62_000, 4, 30)).toBe(122_000)
  })
})

describe('helpers', () => {
  it('change is null without a base', () => {
    expect(change(100, 0)).toBeNull()
    expect(change(150, 100)).toBe(50)
  })

  it('storeChain keeps the first word', () => {
    expect(storeChain(' ライフ 千本店 ')).toBe('ライフ')
  })
})
