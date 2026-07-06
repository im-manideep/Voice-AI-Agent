import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

// Only the tabs this product needs — Home, Practice, Progress.
const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/session', label: 'Practice' },
  { to: '/progress', label: 'Progress' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <Link to="/" onClick={() => setOpen(false)}>
            <span className="font-display text-3xl tracking-tight text-ink">
              Recall<sup className="text-base align-super">®</sup>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? 'text-ink' : 'text-mist hover:text-ink'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => navigate('/session')}
              className="rounded-full bg-ink px-6 py-2.5 text-sm text-paper transition-transform duration-200 hover:scale-[1.03]"
            >
              Begin session
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex flex-col gap-[5px] p-2 md:hidden"
          >
            <span
              className={`h-[2px] w-6 bg-ink transition-transform duration-300 ${open ? 'translate-y-[7px] rotate-45' : ''}`}
            />
            <span className={`h-[2px] w-6 bg-ink transition-opacity duration-300 ${open ? 'opacity-0' : ''}`} />
            <span
              className={`h-[2px] w-6 bg-ink transition-transform duration-300 ${open ? '-translate-y-[7px] -rotate-45' : ''}`}
            />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-10 flex flex-col justify-center gap-8 bg-paper/95 px-8 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className="text-[32px] font-medium text-ink"
          >
            {l.label}
          </Link>
        ))}
        <Link
          to="/session"
          onClick={() => setOpen(false)}
          className="text-[32px] font-medium text-ink underline underline-offset-4"
        >
          Begin session
        </Link>
      </div>
    </>
  )
}
