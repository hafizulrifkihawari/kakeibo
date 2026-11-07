import { QueryCache, QueryClient, onlineManager, queryOptions } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import {
  deleteExpense,
  deleteIncome,
  getMe,
  getPriceStats,
  getProduct,
  getReport,
  glossItems,
  listBudgets,
  listExpenses,
  listIncome,
  listProducts,
  listRules,
  saveBudget,
  saveExpense,
  saveIncome,
  saveRule,
  summarizeReport,
} from '../server/fns'
import type { CategoryRule } from '../../shared/categorizer'
import type { Expense, User } from '../../shared/types'
import type { Income } from '../../shared/income'
import type { Budget } from '../../shared/budget'
import type { PeriodRange } from '../../shared/report'
import { monthRange } from './format'

const ME_KEY = 'jp-expense:me'

export const keys = {
  me: ['me'] as const,
  month: (ym: string) => ['expenses', ym] as const,
  income: (ym: string) => ['income', ym] as const,
  rules: ['rules'] as const,
  budgets: ['budgets'] as const,
  products: ['products'] as const,
  product: (id: number) => ['products', id] as const,
  prices: ['prices'] as const,
  report: ['report'] as const,
}

export const monthQuery = (ym: string) =>
  queryOptions({
    queryKey: keys.month(ym),
    queryFn: () => listExpenses({ data: monthRange(ym) }),
    staleTime: 30_000,
  })

export const incomeQuery = (ym: string) =>
  queryOptions({
    queryKey: keys.income(ym),
    queryFn: () => listIncome({ data: monthRange(ym) }),
    staleTime: 30_000,
  })

/** Sums for one report period and the span it is compared with. */
export const reportQuery = (r: PeriodRange) =>
  queryOptions({
    queryKey: [...keys.report, r.from, r.to, r.prevFrom, r.prevTo] as const,
    queryFn: () => getReport({ data: { from: r.from, to: r.to, prevFrom: r.prevFrom, prevTo: r.prevTo } }),
    staleTime: 60_000,
  })

/**
 * The AI review of a report. It runs only when the user asks (refetch), and is kept forever:
 * `hash` changes when the numbers change, so a stale summary is never shown for new numbers.
 */
export const reportSummaryQuery = (r: PeriodRange, hash: string, facts: unknown) =>
  queryOptions({
    queryKey: ['reportSummary', r.from, r.to, hash] as const,
    queryFn: () => summarizeReport({ data: { facts } }),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  })

/** Furigana and English for item names. Kept forever: the answer for a name does not change. */
export const glossQuery = (names: string[]) =>
  queryOptions({
    queryKey: ['gloss', names] as const,
    queryFn: () => glossItems({ data: { names } }),
    staleTime: Infinity,
    retry: 1,
  })

/** Earlier prices of these products. The expense being edited is left out. */
export const priceStatsQuery = (products: string[], excludeId: string) =>
  queryOptions({
    queryKey: [...keys.prices, products, excludeId] as const,
    queryFn: () => getPriceStats({ data: { products, excludeId } }),
    staleTime: 60_000,
  })

export const productsQuery = queryOptions({
  queryKey: keys.products,
  queryFn: () => listProducts(),
  staleTime: 60_000,
})

export const productQuery = (id: number) =>
  queryOptions({
    queryKey: keys.product(id),
    queryFn: () => getProduct({ data: { id } }),
    staleTime: 60_000,
  })

export const budgetsQuery = queryOptions({
  queryKey: keys.budgets,
  queryFn: () => listBudgets(),
  staleTime: 5 * 60_000,
})

export const rulesQuery = queryOptions({
  queryKey: keys.rules,
  queryFn: () => listRules(),
  staleTime: 5 * 60_000,
})

/** The signed-in user. Offline, falls back to the last known user so the app still opens. */
export async function fetchMe(): Promise<User | null> {
  try {
    const me = await getMe()
    try {
      if (me) localStorage.setItem(ME_KEY, JSON.stringify(me))
      else localStorage.removeItem(ME_KEY)
    } catch {}
    return me
  } catch (e) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const cached = localStorage.getItem(ME_KEY)
        if (cached) return JSON.parse(cached) as User
      } catch {}
    }
    throw e
  }
}

export function forgetMe() {
  try {
    localStorage.removeItem(ME_KEY)
  } catch {}
}

export interface SaveVars {
  expense: Expense
  /** The date before this edit, when it moved to another month. */
  prevDate?: string
}

export interface DeleteVars {
  id: string
  date: string
  /** When the user asked for the delete. The server ignores it if a newer edit exists. */
  at?: number
}

// A change the server did not apply: a newer edit exists, or it failed after its retries.
// The banner shows it, because the list on screen silently goes back to the saved data.
type NoticeListener = () => void
let syncNotice: string | null = null
const noticeListeners = new Set<NoticeListener>()

export function getSyncNotice(): string | null {
  return syncNotice
}

export function subscribeSyncNotice(fn: NoticeListener): () => void {
  noticeListeners.add(fn)
  return () => noticeListeners.delete(fn)
}

export function setSyncNotice(message: string | null) {
  syncNotice = message
  noticeListeners.forEach((fn) => fn())
}

const STALE_NOTICE = 'A change was not saved, because a newer edit exists on another device.'
const FAILED_NOTICE = 'A change could not be saved. Check it and try again.'

function noteResult(res: unknown) {
  if ((res as { stale?: boolean } | undefined)?.stale) setSyncNotice(STALE_NOTICE)
}

function noteError(err: unknown) {
  if (!String((err as Error | undefined)?.message).includes('UNAUTHORIZED')) setSyncNotice(FAILED_NOTICE)
}

export interface SaveIncomeVars {
  income: Income
  /** The date before this edit, when it moved to another month. */
  prevDate?: string
}

function upsert<T extends { id: string; date: string; updatedAt: number }>(list: T[] | undefined, e: T): T[] {
  const rest = (list ?? []).filter((x) => x.id !== e.id)
  return [e, ...rest].sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1))
}

export function createQueryClient(): QueryClient {
  // onlineManager assumes "online" until an event fires. After an offline reload that would send
  // queued saves at once, let them fail, and drop them.
  if (typeof navigator !== 'undefined') onlineManager.setOnline(navigator.onLine)

  const qc: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        if (String(err?.message).includes('UNAUTHORIZED') && typeof window !== 'undefined') {
          forgetMe()
          window.location.assign('/login')
        }
      },
    }),
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        // Keep data for the offline cache. (30 days in ms overflows setTimeout and would gc at once.)
        gcTime: Infinity,
        retry: (count, err) => !String(err?.message).includes('UNAUTHORIZED') && count < 2,
      },
      mutations: { networkMode: 'offlineFirst', retry: 3 },
    },
  })

  // Defaults keyed by mutationKey, so paused offline mutations can resume after a reload.
  qc.setMutationDefaults(['saveExpense'], {
    onSuccess: noteResult,
    onError: noteError,
    mutationFn: ({ expense }: SaveVars) => saveExpense({ data: expense }),
    onMutate: async ({ expense, prevDate }: SaveVars) => {
      const ym = expense.date.slice(0, 7)
      await qc.cancelQueries({ queryKey: keys.month(ym) })
      if (prevDate && prevDate.slice(0, 7) !== ym) {
        qc.setQueryData<Expense[]>(keys.month(prevDate.slice(0, 7)), (l) => l?.filter((x) => x.id !== expense.id))
      }
      qc.setQueryData<Expense[]>(keys.month(ym), (l) => upsert(l, expense))
    },
    onSettled: (_d, _e, { expense }: SaveVars) => {
      if (qc.isMutating({ mutationKey: ['saveExpense'] }) <= 1) {
        qc.invalidateQueries({ queryKey: keys.month(expense.date.slice(0, 7)) })
        qc.invalidateQueries({ queryKey: keys.report })
        qc.invalidateQueries({ queryKey: keys.products })
        qc.invalidateQueries({ queryKey: keys.prices })
      }
    },
  })

  qc.setMutationDefaults(['deleteExpense'], {
    onSuccess: noteResult,
    onError: noteError,
    mutationFn: ({ id, at }: DeleteVars) => deleteExpense({ data: { id, at } }),
    onMutate: async ({ id, date }: DeleteVars) => {
      const key = keys.month(date.slice(0, 7))
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData<Expense[]>(key, (l) => l?.filter((x) => x.id !== id))
    },
    onSettled: (_d, _e, { date }: DeleteVars) => {
      qc.invalidateQueries({ queryKey: keys.month(date.slice(0, 7)) })
      qc.invalidateQueries({ queryKey: keys.report })
      qc.invalidateQueries({ queryKey: keys.products })
      qc.invalidateQueries({ queryKey: keys.prices })
    },
  })

  qc.setMutationDefaults(['saveIncome'], {
    onSuccess: noteResult,
    onError: noteError,
    mutationFn: ({ income }: SaveIncomeVars) => saveIncome({ data: income }),
    onMutate: async ({ income, prevDate }: SaveIncomeVars) => {
      const ym = income.date.slice(0, 7)
      await qc.cancelQueries({ queryKey: keys.income(ym) })
      if (prevDate && prevDate.slice(0, 7) !== ym) {
        qc.setQueryData<Income[]>(keys.income(prevDate.slice(0, 7)), (l) => l?.filter((x) => x.id !== income.id))
      }
      qc.setQueryData<Income[]>(keys.income(ym), (l) => upsert(l, income))
    },
    onSettled: (_d, _e, { income }: SaveIncomeVars) => {
      if (qc.isMutating({ mutationKey: ['saveIncome'] }) <= 1) {
        qc.invalidateQueries({ queryKey: keys.income(income.date.slice(0, 7)) })
        qc.invalidateQueries({ queryKey: keys.report })
      }
    },
  })

  qc.setMutationDefaults(['deleteIncome'], {
    onSuccess: noteResult,
    onError: noteError,
    mutationFn: ({ id, at }: DeleteVars) => deleteIncome({ data: { id, at } }),
    onMutate: async ({ id, date }: DeleteVars) => {
      const key = keys.income(date.slice(0, 7))
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData<Income[]>(key, (l) => l?.filter((x) => x.id !== id))
    },
    onSettled: (_d, _e, { date }: DeleteVars) => {
      qc.invalidateQueries({ queryKey: keys.income(date.slice(0, 7)) })
      qc.invalidateQueries({ queryKey: keys.report })
    },
  })

  qc.setMutationDefaults(['saveBudget'], {
    mutationFn: (b: Budget) => saveBudget({ data: b }),
    onMutate: async (b: Budget) => {
      await qc.cancelQueries({ queryKey: keys.budgets })
      qc.setQueryData<Budget[]>(keys.budgets, (l) => [
        ...(l ?? []).filter((x) => x.scope !== b.scope),
        ...(b.amount > 0 ? [b] : []),
      ])
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['saveBudget'] }) <= 1) qc.invalidateQueries({ queryKey: keys.budgets })
    },
  })

  qc.setMutationDefaults(['saveRule'], {
    mutationFn: (rule: CategoryRule) => saveRule({ data: rule }),
    onMutate: (rule: CategoryRule) => {
      qc.setQueryData<CategoryRule[]>(keys.rules, (l) => [
        rule,
        ...(l ?? []).filter((r) => r.pattern !== rule.pattern),
      ])
    },
  })

  return qc
}

export const persister =
  typeof window !== 'undefined'
    ? createAsyncStoragePersister({
        storage: {
          getItem: (k) => get(k),
          setItem: (k, v) => set(k, v),
          removeItem: (k) => del(k),
        },
        key: 'jp-expense:query-cache',
        throttleTime: 1000,
      })
    : undefined
