import { describe, expect, it } from 'vitest'
import { dayGap, findDuplicate, sameStore } from '../duplicates'
import type { Expense } from '../types'

const saved = (over: Partial<Expense>): Expense => ({
  id: 'a',
  date: '2026-11-04',
  amount: 2_480,
  store: 'ライフ 西五反田店',
  categoryId: 'groceries',
  note: '',
  ocrEngine: 'vision',
  rawText: '',
  items: [],
  updatedAt: 0,
  ...over,
})

const draft = { id: 'new', date: '2026-11-04', amount: 2_480, store: 'ライフ' }

describe('findDuplicate', () => {
  it('matches the same amount and store on the same day', () => {
    expect(findDuplicate(draft, [saved({})])?.id).toBe('a')
  })

  it('matches one day before or after', () => {
    expect(findDuplicate(draft, [saved({ date: '2026-11-03' })])).toBeDefined()
    expect(findDuplicate(draft, [saved({ date: '2026-11-05' })])).toBeDefined()
  })

  it('matches across a month edge', () => {
    const d = { ...draft, date: '2026-11-01' }
    expect(findDuplicate(d, [saved({ date: '2026-10-31' })])).toBeDefined()
  })

  it('matches a full-width name against a half-width name', () => {
    const d = { ...draft, store: 'ＡＥＯＮ Style' }
    expect(findDuplicate(d, [saved({ store: 'aeon style' })])).toBeDefined()
  })

  it('matches when one store is empty', () => {
    expect(findDuplicate({ ...draft, store: '' }, [saved({})])).toBeDefined()
  })

  it('does not match a different amount, a 2-day gap, or another store', () => {
    expect(findDuplicate(draft, [saved({ amount: 2_481 })])).toBeUndefined()
    expect(findDuplicate(draft, [saved({ date: '2026-11-06' })])).toBeUndefined()
    expect(findDuplicate(draft, [saved({ store: 'まいばすけっと' })])).toBeUndefined()
  })

  it('does not match the expense that is being edited', () => {
    expect(findDuplicate({ ...draft, id: 'a' }, [saved({})])).toBeUndefined()
  })

  it('does not match when the amount is 0', () => {
    expect(findDuplicate({ ...draft, amount: 0 }, [saved({ amount: 0 })])).toBeUndefined()
  })
})

describe('helpers', () => {
  it('counts days in UTC', () => {
    expect(dayGap('2026-03-08', '2026-03-09')).toBe(1)
    expect(dayGap('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('compares store names without spaces or punctuation', () => {
    expect(sameStore('セブン-イレブン', 'セブンイレブン 品川店')).toBe(true)
    expect(sameStore('ローソン', 'ファミリーマート')).toBe(false)
  })
})
