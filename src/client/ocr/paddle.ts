// On-device OCR with PP-OCRv5 mobile (detection + recognition) on onnxruntime-web.
// The recognition model reads Japanese, Chinese, and English in one model.
import type * as OrtType from 'onnxruntime-web'

export interface RGBAImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const DET_LIMIT = 1280
const DET_THRESH = 0.3
const BOX_THRESH = 0.6
const UNCLIP_RATIO = 1.5
const REC_HEIGHT = 48
const REC_MAX_WIDTH = 3200

type Ort = typeof OrtType
interface Engine {
  ort: Ort
  det: OrtType.InferenceSession
  rec: OrtType.InferenceSession
  dict: string[]
}

let enginePromise: Promise<Engine> | null = null

/** Loads the runtime and the models once. The files come from /ort and /models (cached by the service worker). */
export function loadPaddle(base = '/'): Promise<Engine> {
  enginePromise ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.logLevel = 'error'
    // The bundled build has the JS glue inside; only the .wasm binary is fetched.
    ort.env.wasm.wasmPaths = { wasm: `${base}ort/ort-wasm-simd-threaded.wasm` }
    ort.env.wasm.numThreads = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? 4 : 1
    const opts: OrtType.InferenceSession.SessionOptions = { executionProviders: ['wasm'], logSeverityLevel: 3 }
    const [det, rec, dictText] = await Promise.all([
      ort.InferenceSession.create(`${base}models/det.onnx`, opts),
      ort.InferenceSession.create(`${base}models/rec.onnx`, opts),
      fetch(`${base}models/dict.txt`).then((r) => r.text()),
    ])
    return { ort: ort as unknown as Ort, det, rec, dict: dictText.split('\n') }
  })().catch((e) => {
    enginePromise = null
    throw e
  })
  return enginePromise
}

/** Bilinear resize of an RGBA image to w×h, then normalize into a BGR CHW float tensor. */
function toTensor(
  img: RGBAImage,
  crop: Box,
  w: number,
  h: number,
  mean: [number, number, number],
  std: [number, number, number],
): Float32Array {
  const out = new Float32Array(3 * w * h)
  const sx = (crop.x1 - crop.x0) / w
  const sy = (crop.y1 - crop.y0) / h
  const plane = w * h
  for (let y = 0; y < h; y++) {
    const fy = Math.min(crop.y0 + (y + 0.5) * sy - 0.5, img.height - 1)
    const y0 = Math.max(0, Math.floor(fy))
    const y1 = Math.min(img.height - 1, y0 + 1)
    const wy = Math.max(0, fy - y0)
    for (let x = 0; x < w; x++) {
      const fx = Math.min(crop.x0 + (x + 0.5) * sx - 0.5, img.width - 1)
      const x0 = Math.max(0, Math.floor(fx))
      const x1 = Math.min(img.width - 1, x0 + 1)
      const wx = Math.max(0, fx - x0)
      const i00 = (y0 * img.width + x0) * 4
      const i01 = (y0 * img.width + x1) * 4
      const i10 = (y1 * img.width + x0) * 4
      const i11 = (y1 * img.width + x1) * 4
      const o = y * w + x
      // Channel order BGR, as the Paddle models expect.
      for (let c = 0; c < 3; c++) {
        const src = 2 - c
        const v =
          (img.data[i00 + src] * (1 - wx) + img.data[i01 + src] * wx) * (1 - wy) +
          (img.data[i10 + src] * (1 - wx) + img.data[i11 + src] * wx) * wy
        out[c * plane + o] = (v / 255 - mean[c]) / std[c]
      }
    }
  }
  return out
}

/** DB post-processing: threshold the probability map, find connected regions, score and expand them. */
function boxesFromMap(prob: Float32Array, w: number, h: number): (Box & { score: number })[] {
  const seen = new Uint8Array(w * h)
  const boxes: (Box & { score: number })[] = []
  const stack: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || prob[start] <= DET_THRESH) continue
    let x0 = w, y0 = h, x1 = 0, y1 = 0, sum = 0, n = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w
      const y = (p - x) / w
      sum += prob[p]
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) {
        if (q >= 0 && !seen[q] && prob[q] > DET_THRESH) {
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (Math.min(bw, bh) < 3) continue
    const score = sum / n
    if (score < BOX_THRESH) continue
    // Unclip: grow the shrunk text kernel back to the full text area.
    const d = (bw * bh * UNCLIP_RATIO) / (2 * (bw + bh))
    boxes.push({
      x0: Math.max(0, x0 - d),
      y0: Math.max(0, y0 - d),
      x1: Math.min(w, x1 + 1 + d),
      y1: Math.min(h, y1 + 1 + d),
      score,
    })
  }
  return boxes
}

function ctcDecode(logits: Float32Array, steps: number, classes: number, dict: string[]): string {
  let text = ''
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    let bestV = -Infinity
    const off = t * classes
    for (let c = 0; c < classes; c++) {
      const v = logits[off + c]
      if (v > bestV) {
        bestV = v
        best = c
      }
    }
    if (best !== prev && best !== 0) {
      // Index 0 is the CTC blank; the class after the dictionary is a space.
      text += best - 1 < dict.length ? dict[best - 1] : ' '
    }
    prev = best
  }
  return text
}

/** Groups boxes whose vertical centers overlap into one line, left to right. */
function joinLines(parts: { box: Box; text: string }[]): string {
  const sorted = [...parts].sort((a, b) => (a.box.y0 + a.box.y1) / 2 - (b.box.y0 + b.box.y1) / 2)
  const lines: { cy: number; h: number; parts: { box: Box; text: string }[] }[] = []
  for (const p of sorted) {
    const cy = (p.box.y0 + p.box.y1) / 2
    const h = p.box.y1 - p.box.y0
    const line = lines.find((l) => Math.abs(l.cy - cy) < Math.min(l.h, h) * 0.5)
    if (line) line.parts.push(p)
    else lines.push({ cy, h, parts: [p] })
  }
  return lines
    .map((l) =>
      l.parts
        .sort((a, b) => a.box.x0 - b.box.x0)
        .map((p) => p.text.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join('\n')
}

export async function recognize(
  img: RGBAImage,
  onProgress?: (done: number, total: number) => void,
  base = '/',
): Promise<string> {
  const { ort, det, rec, dict } = await loadPaddle(base)

  // Detection input: long side ≤ 960, both sides a multiple of 32.
  const scale = Math.min(1, DET_LIMIT / Math.max(img.width, img.height))
  const dw = Math.max(32, Math.round((img.width * scale) / 32) * 32)
  const dh = Math.max(32, Math.round((img.height * scale) / 32) * 32)
  const full: Box = { x0: 0, y0: 0, x1: img.width, y1: img.height }
  const detInput = toTensor(img, full, dw, dh, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
  const detOut = await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', detInput, [1, 3, dh, dw]) })
  const prob = detOut[det.outputNames[0]].data as Float32Array

  const rx = img.width / dw
  const ry = img.height / dh
  const boxes = boxesFromMap(prob, dw, dh).map((b) => ({
    x0: b.x0 * rx,
    y0: b.y0 * ry,
    x1: b.x1 * rx,
    y1: b.y1 * ry,
  }))

  const parts: { box: Box; text: string }[] = []
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const bh = box.y1 - box.y0
    const bw = box.x1 - box.x0
    const w = Math.min(REC_MAX_WIDTH, Math.max(16, Math.round((REC_HEIGHT * bw) / bh)))
    const input = toTensor(img, box, w, REC_HEIGHT, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
    const out = await rec.run({
      [rec.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, REC_HEIGHT, w]),
    })
    const t = out[rec.outputNames[0]]
    const [, steps, classes] = t.dims as number[]
    parts.push({ box, text: ctcDecode(t.data as Float32Array, steps, classes, dict) })
    onProgress?.(i + 1, boxes.length)
  }
  return joinLines(parts)
}
