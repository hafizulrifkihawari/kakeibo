// Points the Telegram bot at the deployed app. Run it once after the first deploy.
//   npm run telegram:webhook                 uses APP_URL from wrangler.jsonc
//   npm run telegram:webhook -- <app url>    another address
// It reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment, then from .dev.vars.
// Use the same values that you gave `wrangler secret put`.
import { existsSync, readFileSync } from 'node:fs'

function devVars(): Record<string, string> {
  if (!existsSync('.dev.vars')) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync('.dev.vars', 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
  return out
}

const vars = { ...devVars(), ...process.env }
const token = vars.TELEGRAM_BOT_TOKEN
const secret = vars.TELEGRAM_WEBHOOK_SECRET
const appUrl = (
  process.argv[2] ?? /"APP_URL"\s*:\s*"([^"]+)"/.exec(readFileSync('wrangler.jsonc', 'utf8'))?.[1] ?? ''
).replace(/\/$/, '')

if (!token || !secret || !appUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET (environment or .dev.vars), and APP_URL.')
  process.exit(1)
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error('TELEGRAM_WEBHOOK_SECRET may use only A-Z, a-z, 0-9, _ and - (1 to 256 characters).')
  process.exit(1)
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${appUrl}/api/telegram`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }),
})
const json = (await res.json()) as { ok: boolean; description?: string }
console.log(json.ok ? `Webhook set: ${appUrl}/api/telegram` : `Failed: ${json.description}`)
if (!json.ok) process.exit(1)
