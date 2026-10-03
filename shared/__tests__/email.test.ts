import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkOrder, SHIPPING_NAME, type EmailOrder } from '../email-check'
import { cutFooter, htmlToText, readEmail } from '../email-text'
import { parseReceipt } from '../receipt-parser'

const carnivoro = new Uint8Array(readFileSync(new URL('./fixtures/carnivoro.order.eml', import.meta.url)))

describe('readEmail', () => {
  const mail = readEmail(carnivoro)

  it('reads the headers', () => {
    expect(mail.from).toBe('Boutique de Carnes Nobres CARNIVORO <store@example.com>')
    expect(mail.subject).toBe('Pedido #10001 confirmado')
    // 12:48 UTC is 21:48 in Japan.
    expect(mail.date).toBe('2026-10-03')
  })

  it('reads the base64 HTML part as text', () => {
    expect(mail.text).toContain('Costela sem osso OX AMH AUSTRALIA')
    expect(mail.text).toContain('冷凍丸鶏中抜きグリラ')
    expect(mail.text).toMatch(/Subtotal\n¥11,680\nFrete\n¥1,500/)
    expect(mail.text).not.toMatch(/<|&nbsp;|font-family/)
  })

  it('drops the text below the total, so the address does not go to the AI', () => {
    expect(mail.text.split('\n').slice(-2)).toEqual(['Total', '¥13,180 JPY'])
    expect(mail.text).not.toContain('千代田')
    expect(mail.text).not.toContain('Endereço')
  })

  it('reads quoted-printable, ISO-2022-JP and encoded headers', () => {
    const eml = [
      'From: =?UTF-8?B?44Ot44O844K944Oz?= <shop@example.com>',
      'Subject: =?UTF-8?Q?=E3=81=94=E6=B3=A8=E6=96=87?=',
      'Date: Fri, 02 Oct 2026 16:30:00 +0000',
      'Content-Type: multipart/alternative; boundary="b1"',
      '',
      '--b1',
      'Content-Type: text/plain; charset=iso-2022-jp',
      'Content-Transfer-Encoding: 7bit',
      '',
      // "合計 1,000円" in ISO-2022-JP.
      '\x1b$B9g7W\x1b(B 1,000\x1b$B1_\x1b(B',
      '--b1',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<p>=E5=90=88=E8=A8=88 2,000=E5=86=86</p>',
      '--b1--',
    ].join('\r\n')
    const m = readEmail(new TextEncoder().encode(eml))
    expect(m.from).toBe('ローソン <shop@example.com>')
    expect(m.subject).toBe('ご注文')
    expect(m.date).toBe('2026-10-03')
    // The plain part wins over the HTML part.
    expect(m.text).toBe('合計 1,000円')
  })

  it('reads pasted text and pasted HTML', () => {
    expect(readEmail('  Item A  ¥500 \n\n Total ¥500 \n Address').text).toBe('Item A ¥500\nTotal ¥500')
    expect(readEmail('<table><tr><td>Item&nbsp;A</td><td>&yen;500</td></tr></table>').text).toBe('Item A ¥500')
  })
})

describe('htmlToText / cutFooter', () => {
  it('puts each table row on one line', () => {
    expect(htmlToText('<style>p{}</style><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr>')).toBe('a b\nc')
  })
  it('keeps the text when there is no total after a price', () => {
    expect(cutFooter('Total\nItem ¥100')).toBe('Total\nItem ¥100')
  })
})

describe('checkOrder', () => {
  // What the AI is expected to return for the Carnivoro email.
  const order: EmailOrder = {
    store: 'CARNIVORO',
    orderDate: '2026-10-03',
    currency: 'JPY',
    items: [
      { name: 'Costela sem osso OX AMH AUSTRALIA', qty: 2, price: 4300 },
      { name: 'Frango inteiro 冷凍丸鶏中抜きグリラー', qty: 1, price: 1500 },
      { name: 'Carne Moída econômica Congelada', qty: 2, price: 3380 },
      { name: 'Acém OX AMH AUSTRALIA', qty: 1, price: 2500 },
    ],
    shipping: 1500,
    discount: 0,
    total: 13180,
  }

  it('adds shipping as an item and passes when the sum is the total', () => {
    const r = checkOrder(order)
    expect(r.needsReview).toBe(false)
    expect(r.total).toBe(13180)
    expect(r.date).toBe('2026-10-03')
    expect(r.items.map((i) => [i.price, i.qty])).toEqual([
      [4300, 2],
      [1500, undefined],
      [3380, 2],
      [2500, undefined],
      [1500, undefined],
    ])
    expect(r.items.at(-1)!.name).toBe(SHIPPING_NAME)
  })

  it('flags an order when the AI counts a tax line as an item', () => {
    const r = checkOrder({ ...order, items: [...order.items, { name: 'Imposto de 8%', qty: 1, price: 865 }] })
    expect(r.needsReview).toBe(true)
  })

  it('subtracts a discount and allows ¥1 of rounding per line', () => {
    expect(checkOrder({ ...order, discount: 500, total: 12681 }).needsReview).toBe(false)
  })

  it('flags another currency and a bad date', () => {
    const r = checkOrder({ ...order, currency: 'USD', orderDate: '03/10/2026' })
    expect(r.needsReview).toBe(true)
    expect(r.date).toBeNull()
  })
})

describe('parseReceipt on email text (no AI)', () => {
  it('finds the total and does not take Subtotal, Frete or Imposto as items', () => {
    const r = parseReceipt(readEmail(carnivoro).text)
    expect(r.total).toBe(13180)
    expect(r.items.map((i) => i.name).join('|')).not.toMatch(/Subtotal|Frete|Imposto|^Total/)
  })
})
