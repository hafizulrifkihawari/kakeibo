// Copies the onnxruntime-web WASM binary into public/ so the app can serve it (and cache it offline).
import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('public/ort', { recursive: true })
copyFileSync(
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
  'public/ort/ort-wasm-simd-threaded.wasm',
)
