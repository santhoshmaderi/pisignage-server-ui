import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { DeployContentDialog } from '@/components/DeployContentDialog'

type NavItem = { to: string; icon: string; label: string }

const PRIMARY: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/players', icon: 'monitor', label: 'Players' },
  { to: '/groups', icon: 'group_work', label: 'Groups' },
  { to: '/assets', icon: 'perm_media', label: 'Assets' },
  { to: '/playlists', icon: 'view_list', label: 'Playlists' },
]

const SECONDARY: NavItem[] = [
  { to: '/settings', icon: 'settings', label: 'Settings' },
]

export type SideNavProps = {
  username: string | null
}

export function SideNav({ username }: SideNavProps) {
  const [deployOpen, setDeployOpen] = useState(false)
  return (
    <nav className="bg-surface-container w-60 h-screen fixed left-0 top-0 border-r border-border-industrial flex flex-col py-6 z-50">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-industrial bg-primary flex items-center justify-center">
          <Icon name="monitor" className="text-on-primary" filled />
        </div>
        <h1 className="text-headline-sm font-bold text-primary">piSignage</h1>
      </div>

      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-variant border border-border-industrial flex items-center justify-center">
          <Icon name="person" className="text-text-muted" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-body-md font-bold text-text-vibrant truncate">
            {username ?? 'Signed Out'}
          </span>
          <span className="text-body-sm text-text-muted">System Admin</span>
        </div>
      </div>

      <ul className="flex flex-col flex-1 px-3 space-y-1">
        {PRIMARY.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary border-r-2 border-primary font-bold bg-surface-container-high'
                    : 'text-text-muted hover:bg-surface-container-high hover:text-text-vibrant',
                )
              }
            >
              <Icon name={item.icon} />
              <span className="text-body-md">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="px-6 mt-auto flex flex-col gap-4">
        <Link
          to="/self-hosted"
          className="block bg-surface-container-high border border-border-industrial rounded-lg p-4 space-y-2 hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-primary">
            <Icon name="dns" size={18} />
            <span className="text-label-caps uppercase tracking-wider">Self-Hosted Server</span>
          </div>
          <p className="text-body-sm text-text-muted">
          Level up your signage — Multi-user Management, Branding, SSO, ready-to-go
          Templates, etc., all in one place
          </p>
          <span className="inline-flex items-center gap-1 text-body-sm text-primary">
            Learn More
            <Icon name="arrow_forward" size={14} />
          </span>
        </Link>

        <Button size="default" className="w-full" onClick={() => setDeployOpen(true)}>
          <Icon name="send" size={18} />
          Deploy Content
        </Button>
        <div className="h-px w-full bg-border-industrial" />
        <ul className="flex flex-col space-y-1">
          {SECONDARY.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 py-2 transition-colors',
                    isActive
                      ? 'text-text-vibrant'
                      : 'text-text-muted hover:text-text-vibrant',
                  )
                }
              >
                <Icon name={item.icon} />
                <span className="text-body-sm">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <DeployContentDialog open={deployOpen} onOpenChange={setDeployOpen} />
    </nav>
  )
}
