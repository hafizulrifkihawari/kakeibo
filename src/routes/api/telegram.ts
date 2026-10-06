import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { sha256, timingSafeEqual } from '../../server/auth'
import { sendTelegram, webhookSecret } from '../../server/telegram'

interface Update {
  message?: { chat: { id: number; type: string }; text?: string }
}

// Telegram webhook (set it with `npm run telegram:webhook`). Telegram sends the secret in a header.
// Always answer 200: Telegram retries anything else.
export const Route = createFileRoute('/api/telegram')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = webhookSecret()
        const got = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
        if (!secret || !timingSafeEqual(got, secret)) return new Response('forbidden', { status: 403 })
        const update = (await request.json().catch(() => null)) as Update | null
        const msg = update?.message
        if (!msg?.text || msg.chat.type !== 'private') return new Response('ok')
        try {
          await handle(msg.chat.id, msg.text.trim())
        } catch (e) {
          console.error('telegram webhook', e)
        }
        return new Response('ok')
      },
    },
  },
})

async function handle(chatId: number, text: string): Promise<void> {
  const start = /^\/start(?:@\w+)?\s+([0-9a-f]{32})$/.exec(text)
  if (!start) {
    await sendTelegram(
      chatId,
      'This bot sends Kakeibo password reset links. To link this chat, open Settings in the app and tap "Link Telegram".',
    )
    return
  }
  const hash = await sha256(start[1])
  const link = await env.DB.prepare(
    `DELETE FROM telegram_links WHERE token_hash = ? AND expires_at > ? RETURNING user_id`,
  )
    .bind(hash, Date.now())
    .first<{ user_id: number }>()
  if (!link) {
    await sendTelegram(chatId, 'This link has expired. Make a new one in Settings.')
    return
  }
  const user = await env.DB.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ? RETURNING email')
    .bind(chatId, link.user_id)
    .first<{ email: string }>()
  await sendTelegram(
    chatId,
    `Linked to ${user?.email}. If you forget your password, tap "Forgot password?" in the app and the reset link comes here.`,
  )
}
