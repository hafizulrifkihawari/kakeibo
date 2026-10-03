import { QueryCache, QueryClient, onlineManager, queryOptions } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import {
  deleteExpense,
  getMe,
  getPriceStats,
  getProduct,
  glossItems,
  listExpenses,
  listProducts,
  listRules,
  saveExpense,
  saveRule,
} from '../server/fns'
import type { CategoryRule } from '../../shared/categorizer'
import type { Expense, User } from '../../shared/types'
import { monthRange } from './format'

const ME_KEY = 'jp-expense:me'

export const keys = {
  me: ['me'] as const,
  month: (ym: string) => ['expenses', ym] as const,
  rules: ['rules'] as const,
  products: ['products'] as const,
  product: (id: number) => ['products', id] as const,
  prices: ['prices'] as const,
}

export const monthQuery = (ym: string) =>
  queryOptions({
    queryKey: keys.month(ym),
    queryFn: () => listExpenses({ data: monthRange(ym) }),
    staleTime: 30_000,
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
}

function upsert(list: Expense[] | undefined, e: Expense): Expense[] {
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
        qc.invalidateQueries({ queryKey: keys.products })
        qc.invalidateQueries({ queryKey: keys.prices })
      }
    },
  })

  qc.setMutationDefaults(['deleteExpense'], {
    mutationFn: ({ id }: DeleteVars) => deleteExpense({ data: { id } }),
    onMutate: async ({ id, date }: DeleteVars) => {
      const key = keys.month(date.slice(0, 7))
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData<Expense[]>(key, (l) => l?.filter((x) => x.id !== id))
    },
    onSettled: (_d, _e, { date }: DeleteVars) => {
      qc.invalidateQueries({ queryKey: keys.month(date.slice(0, 7)) })
      qc.invalidateQueries({ queryKey: keys.products })
      qc.invalidateQueries({ queryKey: keys.prices })
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
