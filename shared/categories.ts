export type CategoryId =
  | 'groceries'
  | 'dining'
  | 'konbini'
  | 'daily'
  | 'transport'
  | 'medical'
  | 'clothing'
  | 'entertainment'
  | 'utilities'
  | 'other'

export interface Category {
  id: CategoryId
  ja: string
  en: string
  icon: string
  /** CSS custom property that holds the category color. */
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'groceries', ja: '食費', en: 'Groceries', icon: '🥬', color: 'var(--cat-groceries)' },
  { id: 'dining', ja: '外食', en: 'Dining', icon: '🍜', color: 'var(--cat-dining)' },
  { id: 'konbini', ja: 'コンビニ', en: 'Konbini', icon: '🏪', color: 'var(--cat-konbini)' },
  { id: 'daily', ja: '日用品', en: 'Daily goods', icon: '🧴', color: 'var(--cat-daily)' },
  { id: 'transport', ja: '交通', en: 'Transport', icon: '🚃', color: 'var(--cat-transport)' },
  { id: 'medical', ja: '医療', en: 'Medical', icon: '💊', color: 'var(--cat-medical)' },
  { id: 'clothing', ja: '衣服', en: 'Clothing', icon: '👕', color: 'var(--cat-clothing)' },
  { id: 'entertainment', ja: '娯楽', en: 'Fun', icon: '🎮', color: 'var(--cat-entertainment)' },
  { id: 'utilities', ja: '公共料金', en: 'Utilities', icon: '💡', color: 'var(--cat-utilities)' },
  { id: 'other', ja: 'その他', en: 'Other', icon: '📦', color: 'var(--cat-other)' },
]

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === 'string' && v in CATEGORY_BY_ID
}
