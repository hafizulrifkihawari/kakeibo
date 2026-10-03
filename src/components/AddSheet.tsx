import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { setPendingFile } from '../client/capture-store'

export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingFile(file)
    onClose()
    navigate({ to: '/add', search: { mode: 'photo' } })
  }

  function go(mode: 'paste' | 'manual') {
    onClose()
    navigate({ to: '/add', search: { mode } })
  }

  return (
    <>
      {/* The inputs stay mounted so the camera opens in the same tap. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} />
      {open && (
        <>
          <div className="sheet-backdrop" onClick={onClose} />
          <div className="sheet" role="dialog" aria-label="Add an expense">
            <div className="grip" />
            <button className="btn btn-primary sheet-primary" onClick={() => cameraRef.current?.click()}>
              <span aria-hidden>📷</span> Scan a receipt
            </button>
            <div className="sheet-grid">
              <button className="btn" onClick={() => uploadRef.current?.click()}>
                <span className="ico" aria-hidden>🖼️</span>
                Upload
              </button>
              <button className="btn" onClick={() => go('paste')}>
                <span className="ico" aria-hidden>📋</span>
                Paste text
              </button>
              <button className="btn" onClick={() => go('manual')}>
                <span className="ico" aria-hidden>✍️</span>
                Manual
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
