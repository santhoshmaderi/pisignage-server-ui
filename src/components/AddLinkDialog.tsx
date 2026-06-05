import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { createLink, fetchLinkDetails, type LinkDetails } from '@/lib/assets'

const LINK_TYPES: { name: string; ext: string }[] = [
  { name: 'Livestreaming or YouTube', ext: '.tv' },
  { name: 'Streaming', ext: '.stream' },
  { name: 'Audio Streaming', ext: '.radio' },
  { name: 'Web link (shown in iframe)', ext: '.link' },
  { name: 'Web page (supports cross origin links)', ext: '.weblink' },
  { name: 'Media RSS', ext: '.mrss' },
  { name: 'Message', ext: '.txt' },
  { name: 'Local Folder/File', ext: '.local' },
]

const RSS_TEXT_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'image' },
  { value: 'title', label: 'image & title' },
  { value: 'description', label: 'image & descr' },
  { value: 'onlytitle', label: 'title' },
  { value: 'onlydescription', label: 'descr' },
  { value: 'onlytitledescr', label: 'title & descr' },
]

const inputCls =
  'w-full bg-surface-container-low border border-border-industrial rounded-industrial px-3 py-2 text-body-md text-text-vibrant focus:border-primary focus:outline-none placeholder:text-text-muted'

function seed(type: string): LinkDetails {
  return {
    name: '',
    type,
    link: '',
    zoom: 1.0,
    hideTitle: 'title',
  }
}

function titleFor(type: string, editing: boolean): string {
  const verb = editing ? 'Edit' : 'Add'
  if (type === '.txt') return `${verb} ${editing ? '' : 'a '}Message`
  if (type === '.local') return `${verb} ${editing ? '' : 'a '}Local Folder/File`
  return `${verb} ${editing ? '' : 'a '}Link`
}

export function AddLinkDialog({
  open,
  initialType,
  editFile = null,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  initialType: string
  /** When set, edit this existing link asset (full filename incl. extension). */
  editFile?: string | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const editing = !!editFile
  const [o, setO] = useState<LinkDetails>(() => seed(initialType))

  // In edit mode, load the stored details and seed the form from them.
  const detailsQuery = useQuery({
    queryKey: ['link', editFile],
    queryFn: () => fetchLinkDetails(editFile as string),
    enabled: open && editing,
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      if (detailsQuery.data) {
        setO({ ...seed(detailsQuery.data.type || '.tv'), ...detailsQuery.data })
      }
    } else {
      setO(seed(initialType))
    }
  }, [open, editing, initialType, detailsQuery.data])

  const set = (patch: Partial<LinkDetails>) => setO((cur) => ({ ...cur, ...patch }))

  const mut = useMutation({
    mutationFn: () => createLink(o),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })

  const isMessage = o.type === '.txt'
  const isMrss = o.type === '.mrss'
  const isLocal = o.type === '.local'
  const needsUrl = !isMessage

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!o.name.trim()) return
    if (isMessage ? !o.message?.trim() : !o.link?.trim()) return
    mut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(x) => !mut.isPending && onOpenChange(x)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name={isMessage ? 'chat' : isLocal ? 'folder' : 'link'} className="text-primary" />
            {titleFor(o.type, editing)}
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Saved as an asset you can drop into playlists. Deploy the group to push it to players.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          <Field label="File Name">
            <Input
              autoFocus={!editing}
              value={o.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Data is saved in this file"
              disabled={editing}
            />
          </Field>

          <Field label="File Type">
            <div className="relative">
              <select
                value={o.type}
                onChange={(e) => set({ type: e.target.value })}
                disabled={editing}
                className={cn(inputCls, 'appearance-none pr-9 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed')}
              >
                {LINK_TYPES.map((t) => (
                  <option key={t.ext} value={t.ext}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Icon
                name="arrow_drop_down"
                size={20}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            </div>
          </Field>

          {/* Media RSS options */}
          {isMrss && (
            <>
              <Field label="RSS Text">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {RSS_TEXT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="hideTitle"
                        checked={o.hideTitle === opt.value}
                        onChange={() => set({ hideTitle: opt.value })}
                        className="w-4 h-4 border-border-industrial bg-surface-container-low text-primary focus:ring-0"
                      />
                      <span className="text-body-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Number of Items">
                  <Input
                    type="number"
                    value={o.numberOfItems ?? ''}
                    onChange={(e) => set({ numberOfItems: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Items to show"
                  />
                </Field>
                <Field label="Item duration (sec)">
                  <Input
                    type="number"
                    value={o.duration ?? ''}
                    onChange={(e) => set({ duration: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="Per-item duration"
                  />
                </Field>
              </div>
            </>
          )}

          {/* Link / URL */}
          {needsUrl && (
            <Field label={isLocal ? 'Local path' : 'Link Address'}>
              <Input
                value={o.link ?? ''}
                onChange={(e) => set({ link: e.target.value })}
                placeholder={isLocal ? 'e.g. /home/pi/media/clip.mp4' : 'e.g. https://site.com or rtsp://…'}
                className="font-mono"
              />
            </Field>
          )}

          {/* Web page zoom */}
          {o.type === '.weblink' && (
            <Field label="Zoom level">
              <Input
                type="number"
                step="0.01"
                value={o.zoom ?? ''}
                onChange={(e) => set({ zoom: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="Leave blank for no zoom"
              />
            </Field>
          )}

          {/* TCP stream */}
          {o.type === '.stream' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!o.tcp}
                onChange={(e) => set({ tcp: e.target.checked })}
                className="w-4 h-4 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0"
              />
              <span className="text-body-md">TCP stream</span>
            </label>
          )}

          {/* Optional CSS (message / rss) */}
          {(isMessage || isMrss) && (
            <Field label="Optional CSS">
              <Input
                value={o.style ?? ''}
                onChange={(e) => set({ style: e.target.value })}
                placeholder="e.g. color:#eee; font-style:italic;"
                className="font-mono"
              />
            </Field>
          )}

          {/* Message text */}
          {isMessage && (
            <Field label="Message">
              <textarea
                rows={4}
                value={o.message ?? ''}
                onChange={(e) => set({ message: e.target.value })}
                placeholder="Enter the message to display…"
                className={cn(inputCls, 'resize-none')}
              />
            </Field>
          )}

          {mut.error != null && (
            <p className="text-body-sm text-status-offline" role="alert">
              {mut.error instanceof Error ? mut.error.message : 'Failed to save'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-caps text-text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}
