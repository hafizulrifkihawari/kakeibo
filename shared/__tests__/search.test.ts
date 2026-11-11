import { describe, expect, it } from 'vitest'
import { buildIndex, foldText, looseRomaji, matchesIndex, parseQuery, toRomaji } from '../search'

const find = (texts: string[], query: string) => matchesIndex(buildIndex(texts), parseQuery(query))

describe('foldText', () => {
  it('turns katakana and full-width text into one form', () => {
    expect(foldText('カルビー')).toBe('かるびー')
    expect(foldText('ＭＩＬＫ ﾎﾟﾃﾄ')).toBe('milkぽてと')
  })
})

describe('toRomaji', () => {
  it('writes Hepburn romaji', () => {
    expect(toRomaji('かるびー')).toBe('karubii')
    expect(toRomaji('ぎゅうにゅう')).toBe('gyuunyuu')
    expect(toRomaji('しょうゆ')).toBe('shouyu')
    expect(toRomaji('ちゃーはん')).toBe('chaahan')
    expect(toRomaji('きって')).toBe('kitte')
    expect(toRomaji('まっちゃ')).toBe('matcha')
    expect(toRomaji('てぃっしゅ')).toBe('tisshu')
    expect(toRomaji('豚こま')).toBe('豚koma')
  })
})

describe('looseRomaji', () => {
  it('lets common spellings match', () => {
    expect(looseRomaji('toufu')).toBe(looseRomaji('tofu'))
    expect(looseRomaji('karubii')).toBe(looseRomaji('karubi'))
    expect(looseRomaji('sinbun')).toBe(looseRomaji('shimbun'))
    expect(looseRomaji('syouyu')).toBe(looseRomaji('shoyu'))
    expect(looseRomaji('chuu')).toBe('chu')
  })
})

describe('search', () => {
  const calbee = ['カルビー ポテトチップス', 'Calbee potato chips', 'かるびーぽてとちっぷす', 'ライフ 新宿店', 'Snacks & sweets', 'お菓子']

  it('matches the name in katakana, hiragana, and romaji', () => {
    expect(find(calbee, 'カルビー')).toBe(true)
    expect(find(calbee, 'かるびー')).toBe(true)
    expect(find(calbee, 'karubi')).toBe(true)
    expect(find(calbee, 'poteto')).toBe(true)
  })

  it('matches the English name, the store, and the kind', () => {
    expect(find(calbee, 'chips')).toBe(true)
    expect(find(calbee, 'raifu')).toBe(true)
    expect(find(calbee, '新宿')).toBe(true)
    expect(find(calbee, 'snack')).toBe(true)
    expect(find(calbee, 'お菓子')).toBe(true)
  })

  it('needs every word to match', () => {
    expect(find(calbee, 'karubi raifu')).toBe(true)
    expect(find(calbee, 'karubi aeon')).toBe(false)
  })

  it('matches kanji through the furigana reading', () => {
    const tofu = ['絹豆腐', 'Silken tofu', 'きぬとうふ']
    expect(find(tofu, '豆腐')).toBe(true)
    expect(find(tofu, 'とうふ')).toBe(true)
    expect(find(tofu, 'kinutofu')).toBe(true)
    expect(find(tofu, 'tofu')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(find(calbee, 'milk')).toBe(false)
    expect(find(calbee, 'ぎゅうにゅう')).toBe(false)
  })
})
