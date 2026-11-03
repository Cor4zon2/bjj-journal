import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

const TABS = [
  { to: '/log', label: 'Log' },
  { to: '/mistakes', label: 'Mistakes' },
  { to: '/techniques', label: 'Library' },
]

export function Layout() {
  const { auth, signOut } = useAuth()
  return (
    <div className="min-h-svh bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <NavLink to="/log" className="text-lg font-bold tracking-tight">
            BJJ Journal
          </NavLink>
          {auth.status === 'signedIn' && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full px-3 py-1.5 text-sm text-slate-400 hover:text-white"
            >
              Sign out
            </button>
          )}
        </div>
        <nav aria-label="Main" className="mx-auto flex max-w-3xl gap-1 px-4 pb-2 text-sm">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400'}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
