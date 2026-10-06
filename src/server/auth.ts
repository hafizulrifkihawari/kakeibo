import { env } from 'cloudflare:workers'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { randomToken, sha256 } from '../../shared/password'

export {
  hashPassword,
  PBKDF2_ITERATIONS,
  randomToken,
  sha256,
  timingSafeEqual,
  verifyPassword,
} from '../../shared/password'

const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

export async function createSession(userId: number): Promise<void> {
  const token = randomToken()
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires)
    .run()
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

export interface SessionUser {
  id: number
  email: string
  telegramLinked: boolean
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.telegram_chat_id IS NOT NULL AS linked
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<{ id: number; email: string; linked: number }>()
  return row ? { id: row.id, email: row.email, telegramLinked: !!row.linked } : null
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

/** The current session token's hash, so a password change can keep this session and end the others. */
export async function currentSessionHash(): Promise<string | null> {
  const token = getCookie(SESSION_COOKIE)
  return token ? sha256(token) : null
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE)
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  }
  deleteCookie(SESSION_COOKIE, { path: '/' })
}
