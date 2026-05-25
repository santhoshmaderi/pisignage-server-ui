import { Icon } from '@/components/Icon'

export type TopBarProps = {
  onSignOut: () => void
}

export function TopBar({ onSignOut }: TopBarProps) {
  return (
    <header className="bg-surface flex justify-between items-center w-full h-16 px-8 border-b border-border-industrial z-40 shrink-0">
      <div className="flex items-center w-1/3">
        <div className="relative w-full max-w-md">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            size={20}
          />
          <input
            type="text"
            placeholder="Search players, assets, groups…"
            className="w-full bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-10 pr-4 py-1.5 text-body-sm text-on-surface placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IconButton icon="dns" label="System status" />
        <IconButton icon="notifications" label="Notifications" hasDot />
        <IconButton icon="logout" label="Sign out" onClick={onSignOut} />
      </div>
    </header>
  )
}

function IconButton({
  icon,
  label,
  hasDot,
  onClick,
}: {
  icon: string
  label: string
  hasDot?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative text-text-muted hover:text-text-vibrant transition-colors flex items-center justify-center w-8 h-8 rounded-industrial hover:bg-surface-container"
    >
      <Icon name={icon} />
      {hasDot && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </button>
  )
}
