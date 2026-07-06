import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

const LINKS = [
  { to: '/session', label: 'Practice' },
  { to: '/progress', label: 'Progress' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="font-display text-[26px] tracking-tight text-ink sm:text-[30px]">
            Recall
          </span>
          <span className="select-none text-[22px] leading-none text-aurora sm:text-[26px]">✳</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-[17px] transition-opacity hover:opacity-60 ${isActive ? 'text-aurora' : 'text-ink'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => navigate('/session')}
          className="pill hidden text-[15px] md:inline-flex"
        >
          Start a session
        </button>

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
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-10 flex flex-col justify-center gap-8 bg-abyss/95 px-8 backdrop-blur-md transition-opacity duration-300 md:hidden ${
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
          className="text-[32px] font-medium text-aurora underline underline-offset-4"
        >
          Start a session
        </Link>
      </div>
    </>
  )
}
