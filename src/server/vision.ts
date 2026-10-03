import { env } from 'cloudflare:workers'

export type VisionResult = { ok: true; text: string } | { ok: false; reason: string }

function currentMonth(): string {
  // Google resets the free tier by calendar month (Pacific time); UTC is close enough with the safety margin.
  return new Date().toISOString().slice(0, 7)
}

export async function visionUsage(): Promise<{ month: string; count: number; limit: number }> {
  const month = currentMonth()
  const row = await env.DB.prepare('SELECT count FROM ocr_usage WHERE month = ?')
    .bind(month)
    .first<{ count: number }>()
  return { month, count: row?.count ?? 0, limit: Number(env.VISION_MONTHLY_LIMIT ?? 950) }
}

/** Reads text with Google Cloud Vision. Returns ok:false when the app must use the on-device fallback. */
export async function visionOcr(imageBase64: string): Promise<VisionResult> {
  const key = (env as unknown as { GOOGLE_VISION_API_KEY?: string }).GOOGLE_VISION_API_KEY
  if (!key) return { ok: false, reason: 'no-key' }

  const limit = Number(env.VISION_MONTHLY_LIMIT ?? 950)
  // Reserve one unit atomically before the call, so parallel requests cannot pass the limit.
  const row = await env.DB.prepare(
    `INSERT INTO ocr_usage (month, count) VALUES (?, 1)
     ON CONFLICT(month) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(currentMonth())
    .first<{ count: number }>()
  if (!row || row.count > limit) return { ok: false, reason: 'quota' }

  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['ja', 'en'] },
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { ok: false, reason: `http-${res.status}` }
    const json = (await res.json()) as {
      responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[]
    }
    const r = json.responses?.[0]
    if (r?.error) return { ok: false, reason: 'api-error' }
    return { ok: true, text: r?.fullTextAnnotation?.text ?? '' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
