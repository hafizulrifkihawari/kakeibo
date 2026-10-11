import { describe, expect, it } from 'vitest'
import { budgetStatus, dailyAllowance, isBudgetScope } from '../budget'

describe('budgetStatus', () => {
  it('is ok when the pace stays inside the limit', () => {
    const s = budgetStatus(100_000, 30_000, 15, 30)
    expect(s).toMatchObject({ remaining: 70_000, projected: 60_000, pace: 'ok' })
    expect(s.used).toBeCloseTo(0.3)
  })

  it('warns when the pace goes over the limit by the month end', () => {
    expect(budgetStatus(40_000, 30_000, 10, 30)).toMatchObject({ projected: 90_000, pace: 'fast' })
  })

  it('is over when the spending is more than the limit', () => {
    expect(budgetStatus(10_000, 12_000, 20, 30)).toMatchObject({ remaining: -2_000, pace: 'over' })
  })

  it('uses the real total for a past month', () => {
    expect(budgetStatus(50_000, 45_000, 31, 31).projected).toBe(45_000)
  })
})

describe('dailyAllowance', () => {
  it('splits the remaining amount over the days left, today included', () => {
    expect(dailyAllowance(budgetStatus(30_000, 10_000, 21, 30), 21, 30)).toBe(2_000)
  })

  it('is 0 when over', () => {
    expect(dailyAllowance(budgetStatus(10_000, 12_000, 5, 30), 5, 30)).toBe(0)
  })
})

describe('isBudgetScope', () => {
  it('accepts total and category ids only', () => {
    expect(isBudgetScope('total')).toBe(true)
    expect(isBudgetScope('groceries')).toBe(true)
    expect(isBudgetScope('beef')).toBe(false)
  })
})
