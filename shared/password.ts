// PBKDF2 password hashing and random tokens. WebCrypto only, so it runs in the Worker and in Node scripts.

// Workers caps PBKDF2 at 100,000 iterations.
export const PBKDF2_ITERATIONS = 100_000

const enc = new TextEncoder()

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Random bytes as hex: 32 bytes for session tokens, 16 for a Telegram start parameter (64 chars max). */
export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)))
}

export async function hashPassword(
  password: string,
  saltHex = randomToken(16),
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

export function timingSafeEqual(a: string, b: string): boolean {
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

/** A temporary password that is easy to read aloud: no 0/O, 1/l/I. */
export function tempPassword(length = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  // 256 is not a multiple of chars.length; the small bias does not matter for a short-lived password.
  return [...bytes].map((b) => chars[b % chars.length]).join('')
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8
