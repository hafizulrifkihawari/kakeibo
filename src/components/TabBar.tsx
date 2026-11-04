import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AddSheet } from './AddSheet'
import { isoMonth } from '../client/format'

export function TabBar() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        <Link to="/" className="tab" activeOptions={{ exact: true }}>
          <span className="ico" aria-hidden>🏠</span>
          Home
        </Link>
        <Link to="/month/$ym" params={{ ym: isoMonth() }} className="tab" activeOptions={{ includeSearch: false }}>
          <span className="ico" aria-hidden>📅</span>
          Calendar
        </Link>
        <button className="tab-add" aria-label="Add an expense" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </button>
        <Link to="/products" className="tab">
          <span className="ico" aria-hidden>🏷️</span>
          Prices
        </Link>
        <Link to="/settings" className="tab">
          <span className="ico" aria-hidden>⚙️</span>
          Settings
        </Link>
      </nav>
      <AddSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
