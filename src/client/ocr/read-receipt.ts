import { ocrImage } from '../../server/fns'
import type { PreparedImage } from '../image'
import type { OcrEngine } from '../../../shared/types'

export type OcrStatus =
  | { step: 'vision' }
  | { step: 'loading-model' }
  | { step: 'device'; done: number; total: number }

export interface OcrOutput {
  engine: Extract<OcrEngine, 'vision' | 'paddle'>
  text: string
  /** Why the app did not use Google Vision, if it did not. */
  fallbackReason?: string
}

/** Google Vision first; on-device PaddleOCR when offline, over quota, or when Vision fails. */
export async function readReceipt(
  img: PreparedImage,
  onStatus: (s: OcrStatus) => void,
): Promise<OcrOutput> {
  let fallbackReason = 'offline'
  if (navigator.onLine) {
    onStatus({ step: 'vision' })
    try {
      const res = await ocrImage({ data: { image: img.base64 } })
      if (res.ok && res.text.trim()) return { engine: 'vision', text: res.text }
      fallbackReason = res.ok ? 'empty' : res.reason
    } catch {
      fallbackReason = 'network'
    }
  }

  onStatus({ step: 'loading-model' })
  const { recognize, loadPaddle } = await import('./paddle')
  await loadPaddle()
  const text = await recognize(img.pixels, (done, total) => onStatus({ step: 'device', done, total }))
  return { engine: 'paddle', text, fallbackReason }
}
