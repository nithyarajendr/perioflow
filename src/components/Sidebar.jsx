import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, Calculator, BarChart3, Settings } from 'lucide-react'
import CompassStar from './CompassStar'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/new-claim', label: 'New Claim', icon: PlusCircle },
  { to: '/cost-estimator', label: 'Cost Estimator', icon: Calculator },
  { to: '/denial-insights', label: 'Denial Insights', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-navy text-cream-light flex flex-col h-screen sticky top-0">
      <div className="px-6 py-8 border-b border-white/10 text-center">
        <div className="flex justify-center text-teal mb-2">
          <CompassStar size={36} strokeWidth={0.9} />
        </div>
        <h1 className="font-serif text-2xl tracking-wide text-cream-light">PerioFlow</h1>
        <p className="text-[10px] uppercase tracking-[0.25em] text-cream-light/60 mt-1.5">Claims Assistant</p>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
  )
}
