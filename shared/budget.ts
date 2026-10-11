import { isCategoryId, type CategoryId } from './categories'

/** 'total' is the limit for all spending. A category id is the limit for that category. */
export type BudgetScope = 'total' | CategoryId

/** A monthly spending limit. The same limit applies to every month. */
export interface Budget {
  scope: BudgetScope
  /** Yen per month. 0 means no limit. */
  amount: number
  /** Epoch ms of the last edit. The newest edit wins on sync. */
  updatedAt: number
}

export function isBudgetScope(v: unknown): v is BudgetScope {
  return v === 'total' || isCategoryId(v)
}

/**
 * - ok: the projected month total stays inside the limit.
 * - fast: the limit is not reached yet, but the current pace goes over it by the month end.
 * - over: the spending is already more than the limit.
 */
export type BudgetPace = 'ok' | 'fast' | 'over'

export interface BudgetStatus {
  limit: number
  spent: number
  /** Limit minus spent. Negative when over. */
  remaining: number
  /** The month total if the spending continues at the average daily pace. */
  projected: number
  /** Spent as a share of the limit, 0..1+. */
  used: number
  pace: BudgetPace
}

/**
 * The state of one limit on day `day` of a month with `days` days.
 * For a past month, pass day = days. Then the projection is the real total.
 */
export function budgetStatus(limit: number, spent: number, day: number, days: number): BudgetStatus {
  const d = Math.min(Math.max(day, 1), days)
  const projected = Math.round((spent / d) * days)
  const pace: BudgetPace = spent > limit ? 'over' : projected > limit ? 'fast' : 'ok'
  return { limit, spent, remaining: limit - spent, projected, used: limit > 0 ? spent / limit : 0, pace }
}

/** How much the user can spend each day for the rest of the month and stay inside the limit. */
export function dailyAllowance(status: BudgetStatus, day: number, days: number): number {
  const left = days - Math.min(Math.max(day, 1), days) + 1
  return Math.max(0, Math.floor(status.remaining / left))
}
