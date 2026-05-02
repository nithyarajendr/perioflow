import { NavLink, Link } from 'react-router-dom'
import { Home, PlusCircle, Calculator, BarChart3, Settings } from 'lucide-react'
import CompassStar from './CompassStar'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/new-claim', label: 'New Claim', icon: PlusCircle },
  { to: '/cost-estimator', label: 'Cost Calculator', icon: Calculator },
  { to: '/denial-insights', label: 'Denial Insights', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/**
 * Sidebar nav. Mobile-first responsive: by default a fixed off-canvas drawer
 * controlled by `mobileOpen`; on md+ the `md:` overrides flip it back to the
 * original inline sticky 256px column. NavLink onClick calls `onClose` so
 * tapping a nav item dismisses the drawer on mobile (no-op on desktop where
 * `mobileOpen` is always false).
 */
export default function Sidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      {/* Backdrop: only renders on mobile when the drawer is open. */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'bg-navy text-cream-light flex flex-col',
          // Mobile: fixed off-canvas drawer; transform toggles visibility.
          'fixed inset-y-0 left-0 w-72 z-50 transform transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // md+: revert to inline sticky column (the original desktop behavior).
          'md:sticky md:top-0 md:translate-x-0 md:w-64 md:shrink-0 md:h-screen md:z-auto',
        ].join(' ')}
      >
        {/* Logo + brand name → home (Dashboard). Closes the drawer on mobile
            via the same onClose used by NavLinks below. */}
        <Link
          to="/"
          onClick={onClose}
          className="block px-6 py-8 border-b border-white/10 text-center hover:bg-cream-light/5 transition-colors"
        >
          <div className="flex justify-center text-teal mb-2">
            <CompassStar size={36} strokeWidth={0.9} />
          </div>
          <h1 className="font-serif text-2xl tracking-wide text-cream-light">PerioFlow</h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-cream-light/60 mt-1.5">Claims Assistant</p>
        </Link>
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-cream-light/10 text-cream-light border-l-2 border-teal'
                    : 'text-cream-light/70 hover:bg-cream-light/5 hover:text-cream-light',
                ].join(' ')
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
