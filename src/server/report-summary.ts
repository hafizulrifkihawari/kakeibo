import { env } from 'cloudflare:workers'
import { MODEL, replyText } from './gloss'

const PROMPT = `You review a personal spending report for one person who lives in Japan. Amounts are in yen.
The input is JSON with the period, totals, the previous period for comparison, months, categories, income sources, top stores, budgets, and findings that were already computed.
Write 3 to 5 short bullet points in plain English, 25 words or fewer each:
- What went well.
- One or two things to watch, with the category or store that causes them.
- One practical tip for the next period, based on the numbers.
Use only the numbers in the input. Do not invent numbers, dates, or reasons. Write amounts as ¥12,345.
Do not repeat the computed findings word for word. Do not start a bullet with a dash or a bullet sign.`

const SCHEMA = {
  type: 'object',
  properties: { bullets: { type: 'array', items: { type: 'string' } } },
  required: ['bullets'],
}

/** Bullet points about a report. Null when the AI is not available or returns bad JSON. */
export async function summarize(facts: string): Promise<string[] | null> {
  try {
    const out = await env.AI.run(MODEL as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: facts },
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 600,
      temperature: 0.3,
    } as never)
    const text = replyText(out)
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { bullets?: unknown }
    if (!Array.isArray(json.bullets)) return null
    const bullets = json.bullets
      .filter((b): b is string => typeof b === 'string')
      .map((b) => b.replace(/^[\s\-•*]+/, '').trim().slice(0, 240))
      .filter(Boolean)
      .slice(0, 5)
    return bullets.length ? bullets : null
  } catch (e) {
    console.warn('report: AI call failed', e)
    return null
  }
}
