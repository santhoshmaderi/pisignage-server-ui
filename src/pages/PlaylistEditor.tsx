import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { fetchPlaylist, savePlaylist, withDefaults, type Playlist } from '@/lib/playlists'
import { SequenceSection } from './playlist/SequenceSection'
import { LayoutSection } from './playlist/LayoutSection'
import { SettingsSection } from './playlist/SettingsSection'

type SectionId = 'sequence' | 'layout' | 'settings'

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'sequence', label: 'Sequence', icon: 'view_list' },
  { id: 'layout', label: 'Layout', icon: 'grid_view' },
  { id: 'settings', label: 'Settings', icon: 'tune' },
]

export function PlaylistEditor() {
  const { name = '' } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const playlistQuery = useQuery({
    queryKey: ['playlist', name],
    queryFn: () => fetchPlaylist(name),
    enabled: Boolean(name),
  })

  // Local working copy. We compare to the server-fetched copy to track dirtiness.
  const [working, setWorking] = useState<Playlist | null>(null)
  const [section, setSection] = useState<SectionId>('sequence')

  useEffect(() => {
    if (playlistQuery.data) setWorking(withDefaults(playlistQuery.data))
  }, [playlistQuery.data])

  const dirty =
    working != null &&
    playlistQuery.data != null &&
    JSON.stringify(working) !== JSON.stringify(withDefaults(playlistQuery.data))

  const saveMut = useMutation({
    mutationFn: (next: Playlist) => savePlaylist(next),
    onSuccess: (saved) => {
      queryClient.setQueryData(['playlist', name], saved)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })

  if (playlistQuery.isLoading || working == null) {
    return (
      <Card className="p-10 text-center">
        <Icon name="hourglass_top" className="text-text-muted/50" size={36} />
        <p className="text-body-md text-text-muted mt-2">Loading playlist…</p>
      </Card>
    )
  }

  if (playlistQuery.isError) {
    const err = playlistQuery.error
    const message = err instanceof Error ? err.message : 'Failed to load playlist'
    return (
      <Card className="p-5 flex items-center gap-3 border-status-offline/30 bg-status-offline/10">
        <Icon name="cloud_off" className="text-status-offline" />
        <div>
          <p className="text-body-md text-text-vibrant">Couldn't load &quot;{name}&quot;</p>
          <p className="text-body-sm text-text-muted font-mono">{message}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/playlists')} className="ml-auto">
          Back to list
        </Button>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body-sm text-text-muted flex items-center gap-1.5">
            <Link to="/playlists" className="hover:text-text-vibrant transition-colors">
              Playlists
            </Link>
            <Icon name="chevron_right" size={14} />
            <span className="text-text-vibrant truncate">{name}</span>
          </div>
          <h2 className="text-headline-lg text-text-vibrant mt-1 truncate">{name}</h2>
        </div>
        <div className="flex items-center gap-3">
          {dirty ? (
            <span className="text-body-sm text-status-syncing font-mono flex items-center gap-1">
              <Icon name="edit" size={14} />
              Unsaved changes
            </span>
          ) : (
            saveMut.isSuccess && (
              <span className="text-body-sm text-status-online font-mono flex items-center gap-1">
                <Icon name="check" size={14} />
                Saved
              </span>
            )
          )}
          <Button variant="outline" onClick={() => navigate('/playlists')}>
            Back
          </Button>
          <Button onClick={() => saveMut.mutate(working)} disabled={!dirty || saveMut.isPending}>
            <Icon name="save" size={18} />
            {saveMut.isPending ? 'Saving…' : 'Save Playlist'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 bg-canvas-depth-1 p-1 rounded-industrial border border-border-industrial self-start">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded text-body-sm transition-colors',
              section === s.id
                ? 'bg-surface-variant text-text-vibrant'
                : 'text-text-muted hover:text-text-vibrant',
            )}
          >
            <Icon name={s.icon} size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {saveMut.error != null && (
        <Card className="p-3 flex items-center gap-2 border-status-offline/30 bg-status-offline/10">
          <Icon name="error" className="text-status-offline" />
          <span className="text-body-sm text-text-vibrant">
            Save failed: {saveMut.error instanceof Error ? saveMut.error.message : 'Unknown error'}
          </span>
        </Card>
      )}

      {section === 'sequence' && <SequenceSection playlist={working} onChange={setWorking} />}
      {section === 'layout' && <LayoutSection playlist={working} onChange={setWorking} />}
      {section === 'settings' && <SettingsSection playlist={working} onChange={setWorking} />}
    </>
  )
}
