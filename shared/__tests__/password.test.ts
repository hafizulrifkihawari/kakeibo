import { describe, expect, it } from 'vitest'
import { hashPassword, randomToken, tempPassword, verifyPassword } from '../password'

describe('password', () => {
  it('verifies the password it hashed, and only that one', async () => {
    const { hash, salt, iterations } = await hashPassword('correct horse', undefined, 1000)
    const user = { password_hash: hash, salt, iterations }
    expect(await verifyPassword('correct horse', user)).toBe(true)
    expect(await verifyPassword('Correct horse', user)).toBe(false)
  })

  it('makes hex tokens of the given size', () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{64}$/)
    // A Telegram start parameter holds at most 64 characters.
    expect(randomToken(16)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('makes temporary passwords with no look-alike characters', () => {
    const p = tempPassword()
    expect(p).toHaveLength(12)
    expect(p).not.toMatch(/[0O1lI]/)
  })
})
