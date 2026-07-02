import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jsPDF } from 'jspdf'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { saveCredentials } from '@/lib/auth'
import {
  deleteLicense,
  fetchLicenses,
  fetchServerInfo,
  fetchSettings,
  saveSettings,
  uploadLicenses,
  type Settings as ServerSettings,
} from '@/lib/settings'

const inputCls =
  'w-full bg-surface-container-low border border-border-industrial rounded-lg px-4 py-2.5 text-body-md font-data-mono text-on-surface focus:border-primary focus:outline-none transition-colors placeholder:text-text-muted'

/** Behavior defaults from the server's settings schema (app/models/settings.js). */
const DEFAULT_BEHAVIORS: Partial<ServerSettings> = {
  enableYoutubeDl: true,
  forceTvOn: false,
  disableCECPowerCheck: false,
  systemMessagesHide: false,
  hideWelcomeNotice: false,
  enableLog: false,
}

export function Settings() {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const licensesQuery = useQuery({ queryKey: ['licenses'], queryFn: fetchLicenses })
  const serverInfoQuery = useQuery({
    queryKey: ['serverInfo'],
    queryFn: fetchServerInfo,
    staleTime: 5 * 60_000,
  })

  // Working copy of the full settings document (includes authCredentials, which
  // the old UI binds directly). Field names mirror the server schema 1:1.
  const [working, setWorking] = useState<ServerSettings | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  useEffect(() => {
    if (settingsQuery.data) setWorking(settingsQuery.data)
  }, [settingsQuery.data])

  const saveMut = useMutation({
    mutationFn: (patch: Partial<ServerSettings>) => saveSettings(patch),
    onSuccess: (saved, patch) => {
      queryClient.setQueryData(['settings'], saved)
      setWorking(saved)
      // The download-access credentials double as this console's HTTP Basic
      // creds. When they change, refresh the stored header so the session keeps
      // working instead of 401-ing on the next request.
      if (patch.authCredentials?.user) {
        saveCredentials({
          username: patch.authCredentials.user,
          password: patch.authCredentials.password ?? '',
        })
      }
      const key = savingKey
      setSavedKey(key)
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000)
    },
    onSettled: () => setSavingKey(null),
  })

  const save = (key: string, patch: Partial<ServerSettings>) => {
    setSavingKey(key)
    saveMut.mutate(patch)
  }

  // License upload
  const fileRef = useRef<HTMLInputElement>(null)
  const [licenseSearch, setLicenseSearch] = useState('')
  const [licenseUploaded, setLicenseUploaded] = useState(false)

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => uploadLicenses(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setLicenseUploaded(true)
      setTimeout(() => setLicenseUploaded(false), 3000)
    },
  })
  const deleteLicenseMut = useMutation({
    mutationFn: (filename: string) => deleteLicense(filename),
    onSuccess: (remaining) => {
      queryClient.setQueryData(['licenses'], remaining)
    },
  })

  if (settingsQuery.isLoading || working == null) {
    return (
      <div className="p-10 text-center bg-surface-container rounded-xl border border-border-industrial">
        <Icon name="hourglass_top" className="text-text-muted/50" size={36} />
        <p className="text-body-md text-text-muted mt-2">Loading settings…</p>
      </div>
    )
  }

  if (settingsQuery.isError) {
    const err = settingsQuery.error
    return (
      <div className="p-5 flex items-center gap-3 rounded-xl border border-status-offline/30 bg-status-offline/10">
        <Icon name="cloud_off" className="text-status-offline" />
        <div>
          <p className="text-body-md text-text-vibrant">Couldn't load settings</p>
          <p className="text-body-sm text-text-muted font-data-mono">
            {err instanceof Error ? err.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  const loaded = settingsQuery.data
  const licenses = licensesQuery.data ?? []
  const filteredLicenses = licenses.filter((l) =>
    l.toLowerCase().includes(licenseSearch.toLowerCase()),
  )
  const creds = working.authCredentials ?? {}
  const credsDirty =
    creds.user !== loaded?.authCredentials?.user ||
    creds.password !== loaded?.authCredentials?.password

  // Generate a PDF report of every registered license and download it (jsPDF,
  // rendered client-side). A PDF reads as a formal artifact and isn't trivially
  // edited like a .txt — though note a PDF is not cryptographically tamper-proof.
  const downloadLicenseReport = () => {
    const now = new Date()
    const info = serverInfoQuery.data
    const doc = new jsPDF()
    const left = 14
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('piSignage — License Report', left, y)
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const meta = [
      `Generated:    ${now.toLocaleString()}`,
      `Installation: ${info?.installation ?? working.installation ?? '—'}`,
      `Server IP:    ${info?.serverIp ?? info?.ip ?? '—'}`,
      `Version:      ${String((info?.version as string) ?? info?.gitVersion ?? '—')}`,
      `Total registered licenses: ${licenses.length}`,
    ]
    for (const line of meta) {
      doc.text(line, left, y)
      y += 6
    }

    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Registered licenses', left, y)
    y += 7
    doc.setFont('courier', 'normal')

    if (licenses.length === 0) {
      doc.text('(no licenses registered)', left, y)
    } else {
      licenses.forEach((l, i) => {
        if (y > 285) {
          doc.addPage()
          y = 20
        }
        doc.text(`${String(i + 1).padStart(3, ' ')}.  ${l}`, left, y)
        y += 6
      })
    }

    doc.save(`pisignage-license-report-${now.toISOString().slice(0, 10)}.pdf`)
  }

  const setField = <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) =>
    setWorking((cur) => (cur ? { ...cur, [key]: value } : cur))
  const setCred = (patch: Partial<NonNullable<ServerSettings['authCredentials']>>) =>
    setWorking((cur) => (cur ? { ...cur, authCredentials: { ...cur.authCredentials, ...patch } } : cur))

  // Toggle + immediately persist a single boolean (old UI saves on change).
  const toggle = (key: keyof ServerSettings, value: boolean) => {
    setField(key, value as ServerSettings[typeof key])
    save(key, { [key]: value } as Partial<ServerSettings>)
  }

  const resetBehaviors = () => {
    setWorking((cur) => (cur ? { ...cur, ...DEFAULT_BEHAVIORS } : cur))
    save('reset', { ...DEFAULT_BEHAVIORS })
  }

  return (
    <div className="space-y-8 max-w-container-max">
      <header>
        <h2 className="text-headline-lg text-text-vibrant">License &amp; Installation Settings</h2>
        <p className="text-text-muted text-body-md mt-2">
          Manage server licensing and configure system-wide playback behaviors.
        </p>
      </header>

      {saveMut.error != null && (
        <div className="p-3 flex items-center gap-2 rounded-xl border border-status-offline/30 bg-status-offline/10">
          <Icon name="error" className="text-status-offline" />
          <span className="text-body-sm text-text-vibrant">
            Save failed: {saveMut.error instanceof Error ? saveMut.error.message : 'Unknown error'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: primary configuration */}
        <div className="lg:col-span-8 space-y-8">
          {/* Section 1: License Management */}
          <section className="bg-surface-container rounded-xl border border-border-industrial overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-high flex justify-between items-center border-b border-border-industrial">
              <div className="flex items-center gap-3">
                <Icon name="verified" className="text-primary" />
                <h3 className="text-headline-sm text-text-vibrant">Available Licenses</h3>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) uploadMut.mutate(files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMut.isPending}
                className="flex items-center gap-2 bg-primary text-on-primary font-bold px-4 py-1.5 rounded hover:brightness-110 transition-all disabled:opacity-50"
              >
                <Icon name="upload" size={16} />
                <span className="text-label-caps uppercase">{uploadMut.isPending ? 'Uploading…' : 'Upload'}</span>
              </button>
            </div>
            <div className="p-8 space-y-6">
              {uploadMut.error != null && (
                <p className="text-body-sm text-status-offline">
                  Upload failed: {uploadMut.error instanceof Error ? uploadMut.error.message : 'Unknown error'}
                </p>
              )}

              {licenseUploaded && (
                <p className="flex items-center gap-2 text-body-sm text-status-online">
                  <Icon name="check_circle" size={16} />
                  License uploaded.
                </p>
              )}

              {licenses.length === 0 ? (
                <div className="p-4 border border-dashed border-border-industrial rounded-lg bg-surface-container-low/50 text-body-sm text-text-muted">
                  Register the player ID at pisignage.com to generate license files, then upload
                  them here (or save them from the registration email). Uploaded licenses are
                  downloaded to players automatically.
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                      size={18}
                    />
                    <input
                      type="text"
                      value={licenseSearch}
                      onChange={(e) => setLicenseSearch(e.target.value)}
                      placeholder="Search licenses..."
                      className={cn(inputCls, 'pl-10 py-3 font-body-md')}
                    />
                  </div>
                  <div>
                    <span className="flex justify-between items-baseline text-label-caps text-text-muted uppercase mb-2">
                      <span>License Pool</span>
                      <span className="normal-case">
                        {filteredLicenses.length} of {licenses.length}
                      </span>
                    </span>
                    {filteredLicenses.length === 0 ? (
                      <div className="p-4 border border-dashed border-border-industrial rounded-lg bg-surface-container-low/50 text-body-sm text-text-muted">
                        No licenses match “{licenseSearch}”.
                      </div>
                    ) : (
                      <ul className="max-h-64 overflow-y-auto rounded-lg border border-border-industrial divide-y divide-border-industrial">
                        {filteredLicenses.map((l) => {
                          const deleting = deleteLicenseMut.isPending && deleteLicenseMut.variables === l
                          return (
                            <li
                              key={l}
                              className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-container-low/50 hover:bg-surface-container-high transition-colors"
                            >
                              <span className="font-data-mono text-body-sm text-on-surface truncate">{l}</span>
                              <button
                                type="button"
                                onClick={() => deleteLicenseMut.mutate(l)}
                                disabled={deleteLicenseMut.isPending}
                                className="shrink-0 flex items-center gap-1 text-error hover:bg-error/10 px-2.5 py-1 rounded border border-error/30 uppercase text-[11px] tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Icon name="delete" size={14} />
                                {deleting ? 'Deleting…' : 'Delete'}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}

              <div className="p-4 border border-border-industrial border-dashed rounded-lg bg-surface-container-low/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon name="info" />
                    </div>
                    <div>
                      <h4 className="text-body-md font-bold text-on-surface">License Summary</h4>
                      <p className="text-body-sm text-text-muted mt-1">
                        {licenses.length === 0
                          ? 'No license files are currently registered on this server.'
                          : `You currently have ${licenses.length} license file${licenses.length === 1 ? '' : 's'} registered on this server.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadLicenseReport}
                    disabled={licenses.length === 0}
                    title="Download a PDF report of all registered licenses"
                    className="shrink-0 flex items-center gap-2 bg-primary text-on-primary font-bold px-4 py-1.5 rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-label-caps uppercase"
                  >
                    <Icon name="download" size={16} />
                    Download License Report
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Installation Settings */}
          <section className="bg-surface-container rounded-xl border border-border-industrial overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-high border-b border-border-industrial flex items-center gap-3">
              <Icon name="settings_system_daydream" className="text-primary" />
              <h3 className="text-headline-sm text-text-vibrant">Installation Settings</h3>
            </div>
            <div className="p-8 space-y-10">
              {/* Single-field rows */}
              <div className="space-y-6">
                <FieldRow
                  label="Username at pisignage.com"
                  dirty={working.installation !== loaded?.installation}
                  saving={savingKey === 'installation'}
                  saved={savedKey === 'installation'}
                  onSave={() => save('installation', { installation: working.installation })}
                  note="Changing this restarts the server."
                >
                  <input
                    type="text"
                    value={working.installation ?? ''}
                    onChange={(e) => setField('installation', e.target.value)}
                    className={inputCls}
                  />
                </FieldRow>

                <FieldRow
                  label="SSH Password"
                  dirty={(working.sshPassword ?? '') !== (loaded?.sshPassword ?? '')}
                  saving={savingKey === 'sshPassword'}
                  saved={savedKey === 'sshPassword'}
                  onSave={() => save('sshPassword', { sshPassword: working.sshPassword })}
                >
                  <input
                    type="password"
                    value={working.sshPassword ?? ''}
                    onChange={(e) => setField('sshPassword', e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    className={inputCls}
                  />
                </FieldRow>

                <FieldRow
                  label="Default Duration for Slides"
                  dirty={working.defaultDuration !== loaded?.defaultDuration}
                  saving={savingKey === 'defaultDuration'}
                  saved={savedKey === 'defaultDuration'}
                  onSave={() => save('defaultDuration', { defaultDuration: working.defaultDuration })}
                >
                  <UnitInput
                    value={working.defaultDuration ?? 10}
                    onChange={(v) => setField('defaultDuration', v)}
                    unit="seconds"
                  />
                </FieldRow>

                <FieldRow
                  label="Player reporting interval"
                  dirty={working.reportIntervalMinutes !== loaded?.reportIntervalMinutes}
                  saving={savingKey === 'reportIntervalMinutes'}
                  saved={savedKey === 'reportIntervalMinutes'}
                  onSave={() =>
                    save('reportIntervalMinutes', { reportIntervalMinutes: working.reportIntervalMinutes })
                  }
                >
                  <UnitInput
                    value={working.reportIntervalMinutes ?? 5}
                    onChange={(v) => setField('reportIntervalMinutes', v)}
                    unit="minutes"
                  />
                </FieldRow>
              </div>

              {/* Download Access */}
              <div className="pt-8 border-t border-border-industrial">
                <h4 className="text-label-caps text-text-muted uppercase mb-6 flex items-center gap-2">
                  <Icon name="download" size={16} />
                  Download Access
                </h4>
                <div className="p-6 rounded-lg border border-border-industrial bg-surface-container-low/30 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex flex-col gap-2">
                      <span className="text-body-sm text-text-muted font-semibold uppercase tracking-wider">Username</span>
                      <input
                        type="text"
                        value={creds.user ?? ''}
                        onChange={(e) => setCred({ user: e.target.value })}
                        autoComplete="username"
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-body-sm text-text-muted font-semibold uppercase tracking-wider">Password</span>
                      <input
                        type="password"
                        value={creds.password ?? ''}
                        onChange={(e) => setCred({ password: e.target.value })}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                    <p className="text-body-sm text-text-muted">
                      These credentials also secure this console — saving updates your current session.
                    </p>
                    <SaveButton
                      label="Save Download Access"
                      dirty={credsDirty}
                      saving={savingKey === 'authCredentials'}
                      saved={savedKey === 'authCredentials'}
                      onClick={() =>
                        save('authCredentials', {
                          authCredentials: { user: creds.user, password: creds.password },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: behaviors & advanced */}
        <div className="lg:col-span-4 space-y-8">
          {/* System Behaviors */}
          <section className="bg-surface-container rounded-xl border border-border-industrial overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-high border-b border-border-industrial flex items-center gap-3">
              <Icon name="dynamic_form" className="text-primary" />
              <h3 className="text-headline-sm text-text-vibrant">System Behaviors</h3>
            </div>
            <div className="p-6 space-y-2">
              <CheckItem
                checked={!!working.enableYoutubeDl}
                onChange={(v) => toggle('enableYoutubeDl', v)}
                label="Use youtube-dl program for livestreaming instead of livestreamer"
              />
              <CheckItem
                checked={!!working.forceTvOn}
                onChange={(v) => toggle('forceTvOn', v)}
                label="Keep TV on by sending CEC tv-on/off message every 3 minutes"
              />
              <CheckItem
                checked={!!working.disableCECPowerCheck}
                onChange={(v) => toggle('disableCECPowerCheck', v)}
                label="Disable CEC power check of TV every 3 minutes"
              />
              <CheckItem
                checked={!!working.systemMessagesHide}
                onChange={(v) => toggle('systemMessagesHide', v)}
                label="Hide system messages on TV Screen (e.g. Download in Progress)"
              />
              <CheckItem
                checked={!!working.hideWelcomeNotice}
                onChange={(v) => toggle('hideWelcomeNotice', v)}
                label="Do not show startup welcome screen & skip network diagnostics"
              />
            </div>
          </section>

          {/* Advanced Config */}
          <section className="bg-surface-container rounded-xl border border-border-industrial overflow-hidden">
            <div className="px-6 py-4 bg-surface-container-high border-b border-border-industrial flex items-center gap-3">
              <Icon name="warning" className="text-error" />
              <h3 className="text-headline-sm text-text-vibrant">Advanced Config</h3>
            </div>
            <div className="p-6">
              <label className="p-5 rounded-lg bg-error-container/5 border border-error/20 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!working.enableLog}
                  onChange={(e) => toggle('enableLog', e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded border-border-industrial bg-surface-container-low text-error focus:ring-0"
                />
                <div>
                  <p className="text-body-md text-on-surface font-bold">Enable file play logs</p>
                  <p className="text-body-sm text-error/80 mt-1 leading-relaxed">
                    Network intensive. Do not enable unless required for auditing. High throughput
                    may impact player performance.
                  </p>
                </div>
              </label>
              <button
                type="button"
                onClick={resetBehaviors}
                disabled={savingKey === 'reset'}
                className="mt-6 w-full bg-surface-container-highest text-on-surface font-bold py-3 rounded-lg text-body-md hover:bg-surface-variant transition-all border border-border-industrial uppercase text-[12px] tracking-wider disabled:opacity-50"
              >
                {savingKey === 'reset' ? 'Resetting…' : 'Reset to Default Behaviors'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Server info (real values, read-only) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon="dns"
          tone="primary"
          label="Installation"
          value={String(serverInfoQuery.data?.installation ?? working.installation ?? '—')}
        />
        <StatCard
          icon="lan"
          tone="tertiary"
          label="Server IP"
          value={String(serverInfoQuery.data?.serverIp ?? serverInfoQuery.data?.ip ?? '—')}
        />
        <StatCard
          icon="commit"
          tone="secondary"
          label="Version"
          value={String((serverInfoQuery.data?.version as string) ?? serverInfoQuery.data?.gitVersion ?? '—')}
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: string
  tone: 'primary' | 'tertiary' | 'secondary'
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    tertiary: 'bg-tertiary/10 text-tertiary',
    secondary: 'bg-secondary/10 text-secondary',
  }
  return (
    <div className="p-6 bg-surface-container rounded-xl border border-border-industrial flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', tones[tone])}>
        <Icon name={icon} size={28} />
      </div>
      <div className="min-w-0">
        <p className="text-label-caps text-text-muted uppercase">{label}</p>
        <p className="font-data-mono text-headline-sm text-text-vibrant truncate">{value}</p>
      </div>
    </div>
  )
}

function FieldRow({
  label,
  note,
  dirty,
  saving,
  saved,
  onSave,
  children,
}: {
  label: string
  note?: string
  dirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-4">
      <label className="md:w-64 md:pt-2.5 text-body-md text-on-surface font-semibold shrink-0">{label}</label>
      <div className="flex-1 w-full">
        <div className="flex gap-2">
          <div className="flex-1">{children}</div>
          <SaveButton dirty={dirty} saving={saving} saved={saved} onClick={onSave} />
        </div>
        {note && <p className="text-body-sm text-text-muted mt-1.5">{note}</p>}
      </div>
    </div>
  )
}

function SaveButton({
  label = 'Save',
  dirty,
  saving,
  saved,
  onClick,
}: {
  label?: string
  dirty: boolean
  saving: boolean
  saved: boolean
  onClick: () => void
}) {
  // Matches the License "Upload" button: solid primary, icon + uppercase caps.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving}
      className="flex items-center justify-center gap-2 bg-primary text-on-primary font-bold px-4 py-1.5 rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-label-caps uppercase shrink-0"
    >
      <Icon name={saved ? 'check' : 'save'} size={16} />
      {saving ? 'Saving…' : saved ? 'Saved' : label}
    </button>
  )
}

function UnitInput({
  value,
  onChange,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  unit: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(inputCls, 'pr-20')}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
        {unit}
      </span>
    </div>
  )
}

function CheckItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-start gap-4 p-3 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 shrink-0 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0"
      />
      <span className="text-body-md text-on-surface group-hover:text-primary transition-colors leading-snug">
        {label}
      </span>
    </label>
  )
}
