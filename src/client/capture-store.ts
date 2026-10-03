// Hands a picked photo from the add sheet to the /add page. A File cannot travel in the URL.
let pending: File | null = null

export function setPendingFile(f: File | null) {
  pending = f
}

export function takePendingFile(): File | null {
  const f = pending
  pending = null
  return f
}
