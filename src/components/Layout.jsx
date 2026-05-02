import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

/**
 * App shell. On md+ (>= 768px) renders the original sidebar+main flex row.
 * On mobile, the sidebar collapses to an off-canvas drawer toggled by a
 * hamburger in a sticky top bar so the main column gets the full viewport
 * width. Desktop is byte-identical: the new mobile chrome (top bar + drawer
 * backdrop) is gated by `md:hidden` and `mobileOpen`.
 */
export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  return (
    <div className="flex min-h-screen bg-bg-soft text-text-strong">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only top bar with hamburger; hidden on md+ so desktop is unchanged. */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-navy text-cream-light">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="p-2 -m-2"
          >
            <Menu size={22} />
          </button>
          <Link to="/" className="font-serif text-lg hover:opacity-90">PerioFlow</Link>
        </header>
        <main className="flex-1 p-4 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
