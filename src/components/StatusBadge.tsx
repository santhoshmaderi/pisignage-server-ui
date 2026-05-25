import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/Icon'

export type PlayerStatus = 'online' | 'offline' | 'syncing'

const LABEL: Record<PlayerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Syncing',
}

export function StatusBadge({ status }: { status: PlayerStatus }) {
  return (
    <Badge tone={status}>
      {status === 'syncing' ? (
        <Icon name="sync" className="animate-spin" size={10} />
      ) : (
        <span
          className={
            status === 'online'
              ? 'inline-block w-1.5 h-1.5 rounded-full bg-status-online'
              : 'inline-block w-1.5 h-1.5 rounded-full bg-status-offline'
          }
        />
      )}
      {LABEL[status]}
    </Badge>
  )
}
