import { describe, expect, it } from 'vitest'
import { categorize } from '../categorizer'

describe('categorize', () => {
  it('sends rent to housing', () => {
    expect(categorize({ store: 'Apato', items: [{ name: 'Apato Rent' }] })).toBe('housing')
    expect(categorize({ store: '不動産', text: '11月分 家賃 管理費' })).toBe('housing')
  })

  it('sends furniture stores and items to furniture', () => {
    expect(categorize({ store: 'ニトリ 京都店' })).toBe('furniture')
    expect(categorize({ store: 'ヨドバシカメラ' })).toBe('furniture')
    expect(categorize({ store: 'Amazon', items: [{ name: 'ベッドフレーム クイーン' }] })).toBe(
      'furniture',
    )
  })

  it('sends souvenirs to gifts', () => {
    expect(categorize({ store: 'みやげ街道', items: [{ name: 'お土産' }] })).toBe('gifts')
  })

  it('does not take a rump steak for furniture', () => {
    expect(categorize({ store: '肉屋', items: [{ name: '牛ランプ ステーキ' }] })).toBe('groceries')
  })
})
