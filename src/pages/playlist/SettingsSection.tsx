import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Icon } from '@/components/Icon'
import type { Playlist } from '@/lib/playlists'

export type SettingsSectionProps = {
  playlist: Playlist
  onChange: (next: Playlist) => void
}

export function SettingsSection({ playlist, onChange }: SettingsSectionProps) {
  const ticker = playlist.settings?.ticker ?? {}
  const audio = playlist.settings?.audio ?? {}

  const setTicker = (patch: Partial<typeof ticker>) =>
    onChange({
      ...playlist,
      settings: {
        ...playlist.settings,
        ticker: { ...ticker, ...patch },
      },
    })

  const setTickerRss = (patch: Partial<NonNullable<typeof ticker.rss>>) =>
    setTicker({ rss: { ...(ticker.rss ?? {}), ...patch } })

  const setAudio = (patch: Partial<typeof audio>) =>
    onChange({
      ...playlist,
      settings: { ...playlist.settings, audio: { ...audio, ...patch } },
    })

  const setRoot = (patch: Partial<Playlist['settings']>) =>
    onChange({ ...playlist, settings: { ...playlist.settings, ...patch } })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Ticker */}
      <Card className="p-5 xl:col-span-2 flex flex-col gap-5">
        <header className="flex justify-between items-start">
          <div>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="subtitles" className="text-primary" size={20} />
              Ticker
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              An overlay strip with scrolling text or an RSS feed.
            </p>
          </div>
          <ToggleRow
            label="Enable ticker"
            checked={!!ticker.enable}
            onChange={(v) => setTicker({ enable: v })}
          />
        </header>

        {ticker.enable && (
          <>
            <div className="rounded-industrial border border-border-industrial bg-canvas-depth-1 p-3 overflow-hidden">
              <div className="text-body-sm text-text-muted mb-2 flex items-center gap-1.5">
                <Icon name="visibility" size={14} /> Preview
              </div>
              <div
                className="font-mono text-body-sm whitespace-nowrap overflow-hidden"
                style={{ color: ticker.color ?? '#ffffff', background: ticker.background ?? 'transparent', padding: '4px 8px', borderRadius: 2 }}
              >
                <span className="inline-block animate-[scroll_18s_linear_infinite]">
                  {ticker.messages || ticker.text || 'Set ticker text below to preview…'}
                </span>
              </div>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-label-caps text-text-muted uppercase mb-2">Source</legend>
              <div className="flex gap-4">
                <Radio
                  name="ticker-source"
                  checked={!ticker.rss?.enable}
                  onChange={() => setTickerRss({ enable: false })}
                  label="Custom text"
                />
                <Radio
                  name="ticker-source"
                  checked={!!ticker.rss?.enable}
                  onChange={() => setTickerRss({ enable: true })}
                  label="RSS feed"
                />
              </div>
              {ticker.rss?.enable ? (
                <FieldLabel label="RSS URL">
                  <Input
                    type="url"
                    placeholder="https://example.com/feed.xml"
                    value={ticker.rss?.link ?? ''}
                    onChange={(e) => setTickerRss({ link: e.target.value })}
                  />
                </FieldLabel>
              ) : (
                <FieldLabel label="Text">
                  <Textarea
                    placeholder="Breaking: …"
                    value={(ticker.messages ?? ticker.text) ?? ''}
                    onChange={(e) =>
                      // Write to both so a save round-trip keeps either consumer happy.
                      setTicker({ messages: e.target.value, text: e.target.value })
                    }
                  />
                </FieldLabel>
              )}
            </fieldset>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FieldLabel label="Speed">
                <NativeSelect
                  // Coerce: some pisignage forks store speed as numeric (1-5).
                  // We map any non-string value to 'normal' for the picker;
                  // the saved value re-becomes a string ('slow' | 'normal' | 'fast').
                  value={
                    typeof ticker.textSpeed === 'string' ? ticker.textSpeed : 'normal'
                  }
                  onChange={(v) => setTicker({ textSpeed: v })}
                  options={[
                    { value: 'slow', label: 'Slow' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'fast', label: 'Fast' },
                  ]}
                />
              </FieldLabel>
              <FieldLabel label="Position">
                <NativeSelect
                  value={ticker.position ?? 'bottom'}
                  onChange={(v) => setTicker({ position: v })}
                  options={[
                    { value: 'top', label: 'Top' },
                    { value: 'bottom', label: 'Bottom' },
                  ]}
                />
              </FieldLabel>
              <FieldLabel label="Color">
                <div className="flex gap-2 h-9">
                  <input
                    type="color"
                    aria-label="Ticker text color"
                    value={ticker.color ?? '#ffffff'}
                    onChange={(e) => setTicker({ color: e.target.value })}
                    className="h-9 w-12 bg-canvas-depth-1 border border-border-industrial rounded-industrial cursor-pointer"
                  />
                  <Input
                    value={ticker.color ?? '#ffffff'}
                    onChange={(e) => setTicker({ color: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </FieldLabel>
            </div>
          </>
        )}
      </Card>

      {/* Audio + Playback */}
      <Card className="p-5 flex flex-col gap-5">
        <header>
          <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
            <Icon name="tune" className="text-primary" size={20} />
            Playback
          </h3>
          <p className="text-body-sm text-text-muted mt-1">
            How the sequence loops and sounds.
          </p>
        </header>

        <ToggleRow
          label="Shuffle assets"
          description="Randomize playback order each loop."
          checked={!!playlist.settings?.random}
          onChange={(v) => setRoot({ random: v })}
        />

        <ToggleRow
          label="Audio output"
          description="Players are muted by default."
          checked={!!audio.enable}
          onChange={(v) => setAudio({ enable: v })}
        />

        {audio.enable && (
          <div className="space-y-3 pl-1">
            <ToggleRow
              label="Shuffle audio"
              checked={!!audio.random}
              onChange={(v) => setAudio({ random: v })}
            />
            <FieldLabel label={`Volume — ${audio.volume ?? 100}%`}>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[audio.volume ?? 100]}
                onValueChange={([v]) => setAudio({ volume: v })}
              />
            </FieldLabel>
          </div>
        )}

        <FieldLabel label="Transition">
          <NativeSelect
            value={playlist.settings?.transition ?? 'none'}
            onChange={(v) => setRoot({ transition: v })}
            options={[
              { value: 'none', label: 'Cut (no transition)' },
              { value: 'fade', label: 'Cross-fade' },
              { value: 'slide', label: 'Slide' },
            ]}
          />
        </FieldLabel>
      </Card>
    </div>
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

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="accent-primary"
      />
      <span className="text-body-md text-text-vibrant">{label}</span>
    </label>
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
