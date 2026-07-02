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
  const ads = playlist.settings?.ads ?? {}
  const domination = playlist.settings?.domination ?? {}
  const event = playlist.settings?.event ?? {}
  const keyPress = playlist.settings?.keyPress ?? {}

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

  const setAds = (patch: Partial<typeof ads>) =>
    onChange({ ...playlist, settings: { ...playlist.settings, ads: { ...ads, ...patch } } })

  const setDomination = (patch: Partial<typeof domination>) =>
    onChange({
      ...playlist,
      settings: { ...playlist.settings, domination: { ...domination, ...patch } },
    })

  const setEvent = (patch: Partial<typeof event>) =>
    onChange({ ...playlist, settings: { ...playlist.settings, event: { ...event, ...patch } } })

  const setKeyPress = (patch: Partial<typeof keyPress>) =>
    onChange({
      ...playlist,
      settings: { ...playlist.settings, keyPress: { ...keyPress, ...patch } },
    })

  const setRoot = (patch: Partial<Playlist['settings']>) =>
    onChange({ ...playlist, settings: { ...playlist.settings, ...patch } })

  return (
    <div className="flex flex-col gap-4">
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
                style={{ color: '#ffffff', ...parseCssText(ticker.style), padding: '4px 8px', borderRadius: 2 }}
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
                  // pisignage stores ticker speed as numeric 1/2/3. NativeSelect
                  // works in strings, so convert at the boundary.
                  value={String(toSpeedNumber(ticker.textSpeed))}
                  onChange={(v) => setTicker({ textSpeed: Number(v) })}
                  options={[
                    { value: '1', label: 'Slow' },
                    { value: '2', label: 'Normal' },
                    { value: '3', label: 'Fast' },
                  ]}
                />
              </FieldLabel>
              <div className="md:col-span-2">
                <FieldLabel label="Style (CSS)">
                  <Input
                    placeholder="e.g. color:#eee; font-style:italic;"
                    value={ticker.style ?? ''}
                    onChange={(e) => setTicker({ style: e.target.value })}
                    className="font-mono"
                  />
                </FieldLabel>
              </div>
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
          label="Independent audio playlist"
          description="Play this playlist's audio out the aux / 3.5 mm port (mp3 files only)."
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
            <ToggleRow
              label="Also output on HDMI"
              checked={!!audio.hdmi}
              onChange={(v) => setAudio({ hdmi: v })}
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

      </Card>
      </div>

      {/* Advanced playback behaviours — parity with the legacy ad / event / key popups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Advertisement playlist */}
        <Card className="p-5 flex flex-col gap-4">
          <header>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="campaign" className="text-primary" size={20} />
              Advertisement Playlist
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              Insert this playlist's assets periodically into the currently playing playlist.
            </p>
          </header>
          <ToggleRow
            label="Make this an advert playlist"
            checked={!!ads.adPlaylist}
            onChange={(v) => setAds({ adPlaylist: v })}
          />
          {ads.adPlaylist && (
            <div className="space-y-3 pl-1">
              <ToggleRow
                label="Don't play the main playlist"
                checked={!!ads.noMainPlay}
                onChange={(v) => setAds({ noMainPlay: v })}
              />
              <FieldLabel label="Assets per insertion">
                <NumberInput value={ads.adCount ?? 1} min={1} onChange={(n) => setAds({ adCount: n })} />
              </FieldLabel>
              <FieldLabel label="Interval (seconds)">
                <NumberInput value={ads.adInterval ?? 60} min={0} onChange={(n) => setAds({ adInterval: n })} />
              </FieldLabel>
            </div>
          )}
        </Card>

        {/* Domination */}
        <Card className="p-5 flex flex-col gap-4">
          <header>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="timer" className="text-primary" size={20} />
              Play once during selected duration
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              Play this playlist once every selected duration by stopping the regular
              playlist — like inserting an advert at fixed intervals.
            </p>
          </header>
          <ToggleRow
            label="Enable (domination content)"
            checked={!!domination.enable}
            onChange={(v) => setDomination({ enable: v })}
          />
          {domination.enable && (
            <FieldLabel label="Every (minutes)">
              <NumberInput
                value={domination.timeInterval ?? 60}
                min={1}
                onChange={(n) => setDomination({ timeInterval: n })}
              />
            </FieldLabel>
          )}
        </Card>

        {/* Event playlist */}
        <Card className="p-5 flex flex-col gap-4">
          <header>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="bolt" className="text-primary" size={20} />
              Event Playlist
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              When a SIGUSR2 event is signalled this playlist is played if eligible.
            </p>
          </header>
          <ToggleRow
            label="Enable"
            checked={!!event.enable}
            onChange={(v) => setEvent({ enable: v })}
          />
          {event.enable && (
            <FieldLabel label="Duration (seconds, 0 = until next event)">
              <NumberInput
                value={Number(event.duration ?? 0)}
                min={0}
                onChange={(n) => setEvent({ duration: n })}
              />
            </FieldLabel>
          )}
        </Card>

        {/* Key event playlist */}
        <Card className="p-5 flex flex-col gap-4">
          <header>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="keyboard" className="text-primary" size={20} />
              Key Event Playlist
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              When the assigned key is pressed this playlist is played if eligible.
            </p>
          </header>
          <ToggleRow
            label="Enable"
            checked={!!keyPress.enable}
            onChange={(v) => setKeyPress({ enable: v })}
          />
          {keyPress.enable && (
            <div className="space-y-3 pl-1">
              <FieldLabel label="Key code">
                <NumberInput
                  value={keyPress.key ?? 0}
                  min={0}
                  onChange={(n) => setKeyPress({ key: n })}
                />
              </FieldLabel>
              <ToggleRow
                label="Play once, then resume"
                checked={!!keyPress.playOnceParameter}
                onChange={(v) => setKeyPress({ playOnceParameter: v })}
              />
            </div>
          )}
        </Card>

        {/* Online only */}
        <Card className="p-5 flex flex-col gap-4 md:col-span-2">
          <header>
            <h3 className="text-headline-sm text-text-vibrant flex items-center gap-2">
              <Icon name="wifi" className="text-primary" size={20} />
              Play only when online
            </h3>
            <p className="text-body-sm text-text-muted mt-1">
              Schedule this playlist to play only when the player is online.
            </p>
          </header>
          <ToggleRow
            label="Enable"
            checked={!!playlist.settings?.onlineOnly}
            onChange={(v) => setRoot({ onlineOnly: v })}
          />
        </Card>
      </div>
    </div>
  )
}

/** Normalise ticker speed to pisignage's numeric scale: 1 (slow) / 2 / 3 (fast). */
function toSpeedNumber(v: unknown): number {
  if (v === 'slow') return 1
  if (v === 'normal') return 2
  if (v === 'fast') return 3
  const n = Number(v)
  return n === 1 || n === 2 || n === 3 ? n : 2
}

/** Parse a CSS declaration string ("color:#eee; font-style:italic;") into a
 *  React style object so the ticker.style value can drive the live preview. */
function parseCssText(css?: string): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const decl of (css ?? '').split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim()
    const val = decl.slice(idx + 1).trim()
    if (!prop || !val) continue
    style[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val
  }
  return style as React.CSSProperties
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="font-mono"
    />
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
