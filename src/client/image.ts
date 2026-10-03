import type { RGBAImage } from './ocr/paddle'

export interface PreparedImage {
  /** JPEG without the data: prefix, for Google Vision. */
  base64: string
  /** Object URL for the on-screen preview. */
  previewUrl: string
  pixels: RGBAImage
}

/** Decodes a photo (honouring EXIF rotation), scales the long side to maxSide, and returns JPEG + pixels. */
export async function prepareImage(file: Blob, maxSide = 1600): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/jpeg', 0.85),
  )
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  const data = ctx.getImageData(0, 0, w, h)
  return {
    base64,
    previewUrl: URL.createObjectURL(blob),
    pixels: { data: data.data, width: w, height: h },
  }
}
