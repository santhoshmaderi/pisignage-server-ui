import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/components/Icon'
import { clearCredentials } from '@/lib/auth'
import {
  fetchServerInfo,
  fetchSettings,
  saveSettings,
  type Settings as ServerSettings,
} from '@/lib/settings'

type CredsChange = { user: string; password: string; confirm: string } | null

export function Settings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const serverInfoQuery = useQuery({
    queryKey: ['serverInfo'],
    queryFn: fetchServerInfo,
    staleTime: 5 * 60_000,
  })

  // Working copy for the non-credential fields.
  const [working, setWorking] = useState<ServerSettings | null>(null)
  // Pending credential change is kept separate; it's only sent if the user
  // explicitly fills it in (we never round-trip the loaded password).
  const [creds, setCreds] = useState<CredsChange>(null)
  const [credsError, setCredsError] = useState<string | null>(null)

  useEffect(() => {
    if (settingsQuery.data) setWorking(stripCreds(settingsQuery.data))
  }, [settingsQuery.data])

  const dirtyFields = useMemo(() => {
    if (!working || !settingsQuery.data) return false
    return JSON.stringify(working) !== JSON.stringify(stripCreds(settingsQuery.data))
  }, [working, settingsQuery.data])

  const dirtyCreds = creds !== null && (creds.user.length > 0 || creds.password.length > 0)
  const dirty = dirtyFields || dirtyCreds

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<ServerSettings>) => saveSettings(patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved)
      // If credentials changed, our cached Basic auth header is now stale —
      // force a sign-out so the login flow re-prompts with the new password.
      if (dirtyCreds) {
        clearCredentials()
        navigate('/login', { replace: true })
      } else {
        setCreds(null)
      }
    },
  })

  if (settingsQuery.isLoading || working == null) {
    return (
      <Card className="p-10 text-center">
        <Icon name="hourglass_top" className="text-text-muted/50" size={36} />
        <p className="text-body-md text-text-muted mt-2">Loading settings…</p>
      </Card>
    )
  }

  if (settingsQuery.isError) {
    const err = settingsQuery.error
    return (
      <Card className="p-5 flex items-center gap-3 border-status-offline/30 bg-status-offline/10">
        <Icon name="cloud_off" className="text-status-offline" />
        <div>
          <p className="text-body-md text-text-vibrant">Couldn't load settings</p>
          <p className="text-body-sm text-text-muted font-mono">
            {err instanceof Error ? err.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    )
  }

  const submit = () => {
    setCredsError(null)
    let patch: Partial<ServerSettings> = { ...working }
    if (creds && (creds.user || creds.password)) {
      if (creds.password && creds.password !== creds.confirm) {
        setCredsError('Password and confirmation do not match.')
        return
      }
      if (!creds.user) {
        setCredsError('Username cannot be empty.')
        return
      }
      patch = {
        ...patch,
        authCredentials: {
          user: creds.user,
          ...(creds.password ? { password: creds.password } : {}),
        },
      }
    }
    saveMut.mutate(patch)
  }

  const currentUser = settingsQuery.data?.authCredentials?.user ?? 'pi'

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-headline-lg text-text-vibrant">Settings</h2>
          <p className="text-body-md text-text-muted mt-1">
            Server-wide configuration. Saved values apply to every console session.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-body-sm text-status-syncing font-mono flex items-center gap-1">
              <Icon name="edit" size={14} />
              Unsaved changes
            </span>
          )}
          {saveMut.isSuccess && !dirty && (
            <span className="text-body-sm text-status-online font-mono flex items-center gap-1">
              <Icon name="check" size={14} />
              Saved
            </span>
          )}
          <Button onClick={submit} disabled={!dirty || saveMut.isPending}>
            <Icon name="save" size={18} />
            {saveMut.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {saveMut.error != null && (
        <Card className="p-3 flex items-center gap-2 border-status-offline/30 bg-status-offline/10">
          <Icon name="error" className="text-status-offline" />
          <span className="text-body-sm text-text-vibrant">
            Save failed: {saveMut.error instanceof Error ? saveMut.error.message : 'Unknown error'}
          </span>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Authentication */}
        <Card className="p-5 xl:col-span-2 flex flex-col gap-4">
          <SectionHeader
            icon="lock"
            title="Authentication"
            description="HTTP Basic Auth credentials for the API. Changing these signs every browser session out."
          />
          <FieldLabel label="Current user">
            <Input value={currentUser} disabled className="font-mono" />
          </FieldLabel>

          {creds === null ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreds({ user: currentUser, password: '', confirm: '' })}
            >
              <Icon name="key" size={16} />
              Change credentials
            </Button>
          ) : (
            <div className="flex flex-col gap-3 p-4 rounded-industrial border border-border-industrial bg-canvas-depth-1">
              <FieldLabel label="New username">
                <Input
                  value={creds.user}
                  onChange={(e) => setCreds({ ...creds, user: e.target.value })}
                  autoComplete="username"
                  className="font-mono"
                />
              </FieldLabel>
              <FieldLabel label="New password">
                <Input
                  type="password"
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                />
              </FieldLabel>
              {creds.password && (
                <FieldLabel label="Confirm password">
                  <Input
                    type="password"
                    value={creds.confirm}
                    onChange={(e) => setCreds({ ...creds, confirm: e.target.value })}
                    autoComplete="new-password"
                  />
                </FieldLabel>
              )}
              {credsError && (
                <p className="text-body-sm text-status-offline" role="alert">
                  {credsError}
                </p>
              )}
              <div className="flex gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreds(null)
                    setCredsError(null)
                  }}
                >
                  Cancel
                </Button>
                <p className="text-body-sm text-text-muted">
                  Save below to apply. You will be signed out.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Branding / locale */}
        <Card className="p-5 flex flex-col gap-4">
          <SectionHeader icon="palette" title="General" />
          <FieldLabel label="Language">
            <NativeSelect
              value={working.language ?? 'en'}
              onChange={(v) => setWorking({ ...working, language: v })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'fr', label: 'Français' },
                { value: 'de', label: 'Deutsch' },
                { value: 'pt', label: 'Português' },
                { value: 'zh', label: '中文' },
                { value: 'ja', label: '日本語' },
              ]}
            />
          </FieldLabel>
          <FieldLabel label="Logo (asset filename)">
            <Input
              value={working.logo ?? ''}
              onChange={(e) => setWorking({ ...working, logo: e.target.value })}
              placeholder="e.g. company_logo.png"
              className="font-mono"
            />
          </FieldLabel>
          <ToggleRow
            label="Hide welcome notice"
            description="Skip the splash on the legacy AngularJS UI."
            checked={!!working.hideWelcomeNotice}
            onChange={(v) => setWorking({ ...working, hideWelcomeNotice: v })}
          />
        </Card>

        {/* Player defaults */}
        <Card className="p-5 flex flex-col gap-4 xl:col-span-2">
          <SectionHeader
            icon="monitor"
            title="Player Defaults"
            description="Applied to every player that registers. Existing players keep their current values until they next sync."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldLabel label="Default asset duration (sec)">
              <Input
                type="number"
                min={1}
                max={600}
                value={working.defaultDuration ?? 10}
                onChange={(e) =>
                  setWorking({ ...working, defaultDuration: Number(e.target.value) })
                }
                className="font-mono"
              />
            </FieldLabel>
            <FieldLabel label="Status report interval (min)">
              <Input
                type="number"
                min={1}
                max={60}
                value={working.reportIntervalMinutes ?? 5}
                onChange={(e) =>
                  setWorking({
                    ...working,
                    reportIntervalMinutes: Number(e.target.value),
                  })
                }
                className="font-mono"
              />
            </FieldLabel>
            <FieldLabel label="SSH password (Pi default: pi)">
              <Input
                type="password"
                value={working.sshPassword ?? ''}
                onChange={(e) => setWorking({ ...working, sshPassword: e.target.value })}
                placeholder="••••••"
                autoComplete="off"
              />
            </FieldLabel>
          </div>
          <ToggleRow
            label="Enable YouTube downloads"
            description="Allow assets sourced from YouTube URLs. Requires youtube-dl on the server."
            checked={!!working.enableYoutubeDl}
            onChange={(v) => setWorking({ ...working, enableYoutubeDl: v })}
          />
        </Card>

        {/* Server info (read-only) */}
        <Card className="p-5 flex flex-col gap-3">
          <SectionHeader
            icon="dns"
            title="Server Info"
            description="Read-only. Surfaced from /api/serverconfig."
          />
          {serverInfoQuery.isLoading ? (
            <p className="text-body-sm text-text-muted">Loading…</p>
          ) : serverInfoQuery.isError ? (
            <p className="text-body-sm text-text-muted">Not available on this server.</p>
          ) : (
            <dl className="space-y-2 font-mono text-data-mono">
              <InfoRow
                label="Installation"
                value={serverInfoQuery.data?.installation ?? working.installation}
              />
              <InfoRow
                label="IP"
                value={serverInfoQuery.data?.serverIp ?? serverInfoQuery.data?.ip}
              />
              <InfoRow label="Version" value={serverInfoQuery.data?.gitVersion} />
            </dl>
          )}
        </Card>
      </div>
    </>
  )
}

function stripCreds(s: ServerSettings): ServerSettings {
  // The form never edits the password via the working copy — it goes through
  // the dedicated creds dialog. Exclude it from dirty comparison so changing
  // other fields doesn't accidentally try to overwrite the password.
  const { authCredentials: _drop, ...rest } = s
  void _drop
  return rest
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description?: string
}) {
  return (
    <header>
      <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
        <Icon name={icon} className="text-primary" size={20} />
        {title}
      </h3>
      {description && <p className="text-body-sm text-text-muted mt-1">{description}</p>}
    </header>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-caps text-text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-body-md text-text-vibrant">{label}</p>
        {description && <p className="text-body-sm text-text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NativeSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none h-9 w-full bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-3 pr-9 text-body-md text-text-vibrant focus:outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="arrow_drop_down"
        size={20}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: unknown }) {
  const display =
    value === undefined || value === null || value === ''
      ? '—'
      : typeof value === 'string'
      ? value
      : JSON.stringify(value)
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-vibrant truncate">{display}</dd>
    </div>
  )
}
