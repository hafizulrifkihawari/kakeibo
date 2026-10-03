import { env } from 'cloudflare:workers'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

// Workers caps PBKDF2 at 100,000 iterations.
export const PBKDF2_ITERATIONS = 100_000
const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function hashPassword(
  password: string,
  saltHex = toHex(crypto.getRandomValues(new Uint8Array(16))),
  iterations = PBKDF2_ITERATIONS,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  )
  return { hash: toHex(bits), salt: saltHex, iterations }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(
  password: string,
  user: { password_hash: string; salt: string; iterations: number },
): Promise<boolean> {
  const { hash } = await hashPassword(password, user.salt, user.iterations)
  return timingSafeEqual(hash, user.password_hash)
}

async function sha256(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)))
}

export async function createSession(userId: number): Promise<void> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)))
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
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<SessionUser>()
  return row ?? null
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE)
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  }
  deleteCookie(SESSION_COOKIE, { path: '/' })
}
