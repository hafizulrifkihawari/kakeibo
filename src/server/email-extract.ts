import { env } from 'cloudflare:workers'
import type { EmailOrder } from '../../shared/email-check'
import { MODEL, replyText } from './gloss'

const PROMPT = `You read online-shop order emails (Japanese, English, Portuguese, or other languages) and return the order as JSON.
- "store": the short shop name, for example "CARNIVORO" or "Amazon". Not the email address.
- "orderDate": the date of the order as YYYY-MM-DD. Not the delivery date. Use "" when the email has no order date.
- "currency": the currency code, for example "JPY".
- "items": one object for each product line, in the order of the email.
  - "name": a short product name, 60 characters or fewer. Keep the original language. Leave out marketing text, tax notes ("com imposto de 8% incluso", "税込"), and price-per-kg notes.
  - "qty": the count after "×" or "x" or in a quantity column. 1 when there is none.
  - "price": the line price in the price column, as a number (the price for all of qty). Not a price written inside the product description.
- "shipping": the shipping or delivery fee (Frete, 送料, Shipping). 0 when there is none.
- "discount": the discount amount as a positive number. 0 when there is none.
- "total": the amount paid (Total, 合計, ご請求額).
Tax lines (Imposto, 消費税, Tax) that are already included in the prices are not items, not shipping, and not discount.
Use numbers without commas or currency signs.`

const SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string' },
    orderDate: { type: 'string' },
    currency: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } },
        required: ['name', 'qty', 'price'],
      },
    },
    shipping: { type: 'number' },
    discount: { type: 'number' },
    total: { type: 'number' },
  },
  required: ['store', 'orderDate', 'currency', 'items', 'shipping', 'discount', 'total'],
}

/** The order in an email, read by Workers AI. Null when the AI is not available or returns bad JSON. */
export async function extractOrder(input: { text: string; from?: string; subject?: string; date?: string }): Promise<EmailOrder | null> {
  const header = [
    input.from && `From: ${input.from}`,
    input.subject && `Subject: ${input.subject}`,
    input.date && `Email date (Japan): ${input.date}`,
  ]
    .filter(Boolean)
    .join('\n')
  try {
    const out = await env.AI.run(MODEL as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `${header}\n\n${input.text}` },
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 2000,
      temperature: 0.1,
    } as never)
    const text = replyText(out)
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Partial<EmailOrder>
    if (!Array.isArray(json.items)) return null
    return {
      store: typeof json.store === 'string' ? json.store : '',
      // The email date is the order date when the AI does not find one.
      orderDate: typeof json.orderDate === 'string' && json.orderDate ? json.orderDate : (input.date ?? ''),
      currency: typeof json.currency === 'string' ? json.currency : '',
      items: json.items.filter((i) => i && typeof i === 'object'),
      shipping: Number(json.shipping) || 0,
      discount: Number(json.discount) || 0,
      total: Number(json.total) || 0,
    }
  } catch (e) {
    console.warn('email: AI call failed', e)
    return null
  }
}
