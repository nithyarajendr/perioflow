import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, BarChart3, Settings } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/new-claim', label: 'New Claim', icon: PlusCircle },
  { to: '/denial-insights', label: 'Denial Insights', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-navy text-white flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-semibold tracking-tight">PerioFlow</h1>
        <p className="text-xs text-white/60 mt-1">Claims Assistant</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-teal/20 text-white border-l-2 border-teal'
                  : 'text-white/70 hover:bg-white/5 hover:text-white',
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
