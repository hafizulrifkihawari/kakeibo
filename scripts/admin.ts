// Admin tools for accounts. They run on your computer through wrangler, so they work when nobody can log in.
//   npm run admin -- reset <email> [--remote]          set a temporary password and log out every device
//   npm run admin -- collect <email> on|off [--remote] keep this user's scanned photos for a local model
// Without --remote, the local development database changes.
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { EMAIL_RE, hashPassword, tempPassword } from '../shared/password'

const DB = 'jp-expense'

function d1(sql: string, remote: boolean): Record<string, unknown>[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, remote ? '--remote' : '--local', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  const json = JSON.parse(out) as { results: Record<string, unknown>[] }[]
  return json.flatMap((r) => r.results)
}

/** wrangler has no bind parameters: allow only a plain email, and double any single quote. */
function quoteEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error(`Not a valid email: ${raw}`)
  return `'${email.replaceAll("'", "''")}'`
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} Type "yes" to continue: `)
  rl.close()
  return answer.trim() === 'yes'
}

async function reset(rawEmail: string, remote: boolean) {
  const email = quoteEmail(rawEmail)
  const where = remote ? 'PRODUCTION' : 'local'
  const [user] = d1(`SELECT id FROM users WHERE email = ${email}`, remote)
  if (!user) throw new Error(`No user with the email ${rawEmail} in the ${where} database.`)
  if (remote && !(await confirm(`Reset the password of ${rawEmail} in the ${where} database?`))) {
    console.log('Stopped. Nothing changed.')
    return
  }
  const password = tempPassword()
  const { hash, salt, iterations } = await hashPassword(password)
  const id = Number(user.id)
  // hash and salt are hex, iterations and id are numbers: safe to put in the SQL text.
  d1(
    `UPDATE users SET password_hash = '${hash}', salt = '${salt}', iterations = ${iterations} WHERE id = ${id};
     DELETE FROM sessions WHERE user_id = ${id};`,
    remote,
  )
  console.log(`\nTemporary password for ${rawEmail}: ${password}`)
  console.log('Log in with it, then change it in Settings.')
}

async function collect(rawEmail: string, on: boolean, remote: boolean) {
  const email = quoteEmail(rawEmail)
  const where = remote ? 'PRODUCTION' : 'local'
  const [user] = d1(`SELECT id FROM users WHERE email = ${email}`, remote)
  if (!user) throw new Error(`No user with the email ${rawEmail} in the ${where} database.`)
  const id = Number(user.id)
  if (on) {
    const ask = `Keep the scanned receipt photos of ${rawEmail} in the ${where} database until the sync tool downloads them? Turn this on only for your own account or with the user's consent.`
    if (remote && !(await confirm(ask))) {
      console.log('Stopped. Nothing changed.')
      return
    }
    d1(`UPDATE users SET collect_scans = 1 WHERE id = ${id}`, remote)
    console.log(`Scan collection is on for ${rawEmail}. The app sees the change within 5 minutes, or at the next login.`)
    return
  }
  d1(`UPDATE users SET collect_scans = 0 WHERE id = ${id}`, remote)
  const [row] = d1(`SELECT count(*) AS n FROM receipt_scans WHERE user_id = ${id}`, remote)
  console.log(`Scan collection is off for ${rawEmail}.`)
  if (Number(row?.n)) {
    console.log(`${row.n} photos still wait for the sync tool. Run it, or delete them:`)
    console.log(`  npx wrangler d1 execute ${DB} ${remote ? '--remote' : '--local'} --command "DELETE FROM receipt_scans WHERE user_id = ${id}"`)
  }
}

const [cmd, email, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const remote = process.argv.includes('--remote')

try {
  if (cmd === 'reset' && email) await reset(email, remote)
  else if (cmd === 'collect' && email && (arg === 'on' || arg === 'off')) await collect(email, arg === 'on', remote)
  else {
    console.log('Usage: npm run admin -- reset <email> [--remote]')
    console.log('       npm run admin -- collect <email> on|off [--remote]')
    process.exitCode = 1
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
}
