import { env } from 'cloudflare:workers'

// Telegram Bot API: free, and needs no domain. It carries password reset links instead of email.
// Secrets (not in wrangler.jsonc): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET.

interface TelegramSecrets {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_WEBHOOK_SECRET?: string
  /** Local tests only: a mock Bot API server. */
  TELEGRAM_API?: string
}

const secrets = () => env as unknown as TelegramSecrets

export function telegramConfigured(): boolean {
  return !!secrets().TELEGRAM_BOT_TOKEN
}

export function webhookSecret(): string {
  return secrets().TELEGRAM_WEBHOOK_SECRET ?? ''
}

/** The app's public address, for links in messages. */
export function appUrl(): string {
  return env.APP_URL.replace(/\/$/, '')
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const token = secrets().TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram is not set up on this server.')
  const base = secrets().TELEGRAM_API ?? 'https://api.telegram.org'
  const res = await fetch(`${base}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null
  if (!json?.ok) throw new Error(`Telegram ${method} failed: ${json?.description ?? res.status}`)
  return json.result
}

export async function sendTelegram(chatId: number, text: string): Promise<void> {
  await call('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } })
}

let username: Promise<string> | undefined

/** The bot's @username, from getMe. Kept for the life of the isolate. */
export function botUsername(): Promise<string> {
  username ??= call<{ username: string }>('getMe')
    .then((me) => me.username)
    .catch((e) => {
      username = undefined
      throw e
    })
  return username
}
