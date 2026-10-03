import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { CategoryId } from '../../../shared/categories'
import { categorize } from '../../../shared/categorizer'
import { parseReceipt } from '../../../shared/receipt-parser'
import type { Expense, OcrEngine } from '../../../shared/types'
import { takePendingFile } from '../../client/capture-store'
import { isoDate, uuid } from '../../client/format'
import { prepareImage } from '../../client/image'
import { readReceipt, type OcrStatus } from '../../client/ocr/read-receipt'
import { rulesQuery } from '../../client/queries'
import { ExpenseForm } from '../../components/ExpenseForm'

type Mode = 'photo' | 'paste' | 'manual'

export const Route = createFileRoute('/_app/add')({
  validateSearch: (s: Record<string, unknown>): { mode: Mode } => ({
    mode: s.mode === 'paste' || s.mode === 'manual' ? s.mode : 'photo',
  }),
  component: AddPage,
})

const ENGINE_LABEL: Record<OcrEngine, string> = {
  vision: '☁️ Read by Google Vision',
  paddle: '📱 Read on this device',
  paste: '📋 Read from pasted text',
  manual: '',
}

const FALLBACK_LABEL: Record<string, string> = {
  quota: 'The free Google Vision quota for this month is used up.',
  offline: 'You are offline.',
  'no-key': 'Google Vision is not set up.',
}

function blank(): Expense {
  return {
    id: uuid(),
    date: isoDate(),
    amount: 0,
    store: '',
    categoryId: 'other',
    note: '',
    ocrEngine: 'manual',
    rawText: '',
    items: [],
    updatedAt: Date.now(),
  }
}

function AddPage() {
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const rules = useQuery(rulesQuery)
  const [draft, setDraft] = useState<{ expense: Expense; suggested?: CategoryId; note?: string } | null>(
    mode === 'manual' ? { expense: blank() } : null,
  )
  const [status, setStatus] = useState<OcrStatus | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const pickRef = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  function fromText(text: string, engine: OcrEngine, note?: string) {
    const r = parseReceipt(text)
    const suggested = categorize({ store: r.store ?? '', text, items: r.items }, rules.data ?? [])
    setDraft({
      expense: {
        ...blank(),
        date: r.date ?? isoDate(),
        amount: r.total ?? r.items.reduce((s, i) => s + i.price, 0),
        store: r.store ?? '',
        categoryId: suggested,
        ocrEngine: engine,
        rawText: text,
        items: r.items,
      },
      suggested,
      note,
    })
  }

  async function scan(file: File) {
    setError('')
    setDraft(null)
    try {
      const img = await prepareImage(file)
      setPreview(img.previewUrl)
      const out = await readReceipt(img, setStatus)
      if (!out.text.trim()) throw new Error('No text found. Try again with the whole receipt in the photo and good light.')
      fromText(out.text, out.engine, out.fallbackReason ? FALLBACK_LABEL[out.fallbackReason] : undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the receipt.')
    } finally {
      setStatus(null)
    }
  }

  useEffect(() => {
    if (mode !== 'photo' || started.current) return
    started.current = true
    const f = takePendingFile()
    if (f) scan(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const done = (saved: Expense | null) =>
    navigate({ to: '/day/$date', params: { date: saved?.date ?? isoDate() } })

  return (
    <main className="page stack">
      <h1 className="page-title">
        {mode === 'paste' ? 'Paste receipt text' : mode === 'manual' ? 'New expense' : 'Scan a receipt'}
      </h1>

      {preview && <img className="receipt-preview" src={preview} alt="Receipt photo" />}

      {status && (
        <div className="card ocr-status" role="status">
          <div className="spinner" />
          <div>
            {status.step === 'vision' && 'Reading the receipt…'}
            {status.step === 'loading-model' && 'Loading the on-device reader…'}
            {status.step === 'device' && `Reading on this device… ${status.done}/${status.total}`}
          </div>
        </div>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {mode === 'photo' && !draft && !status && (
        <div className="card stack">
          <p className="muted" style={{ margin: 0 }}>
            Take a photo of the whole receipt, flat and in good light.
          </p>
          <input
            ref={pickRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) scan(f)
            }}
          />
          <button className="btn btn-primary btn-block" onClick={() => pickRef.current?.click()}>
            📷 Choose or take a photo
          </button>
        </div>
      )}

      {mode === 'paste' && !draft && (
        <div className="card stack">
          <p className="muted small" style={{ margin: 0 }}>
            Tip: open the receipt in Google Lens, tap <b>Select all → Copy text</b>, and paste it here.
          </p>
          <textarea
            className="input"
            placeholder="ローソン&#10;2026年10月2日&#10;おにぎり ¥150&#10;合計 ¥581"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            autoFocus
          />
          <button
            className="btn btn-primary btn-block"
            disabled={!pasted.trim()}
            onClick={() => fromText(pasted, 'paste')}
          >
            Read text
          </button>
        </div>
      )}

      {draft && (
        <>
          {draft.expense.ocrEngine !== 'manual' && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="engine-badge">{ENGINE_LABEL[draft.expense.ocrEngine]}</span>
              {draft.note && <span className="muted small">{draft.note}</span>}
            </div>
          )}
          {draft.expense.ocrEngine !== 'manual' && (
            <p className="muted small" style={{ margin: 0 }}>
              Check the details, then save.
            </p>
          )}
          <ExpenseForm
            key={draft.expense.id}
            initial={draft.expense}
            suggestedCategory={draft.suggested}
            isNew
            onDone={done}
          />
        </>
      )}
    </main>
  )
}
