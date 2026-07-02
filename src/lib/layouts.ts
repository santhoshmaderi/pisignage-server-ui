/**
 * Zone layouts pisignage-server supports out of the box.
 *
 * The `id` is authoritative — the player firmware renders zones from it, so
 * these ids/titles/dimensions are copied verbatim from the server's layout
 * catalogue (legacy `playlists.js` $scope.layouts + `layoutOtherZones`). Zone
 * rects are normalized 0..1 only for drawing the preview diagram; zone *ids*
 * (main / side / bottom) match what the player uses for asset routing.
 */
export type LayoutZoneId = 'main' | 'side' | 'bottom' | 'top'

export type LayoutZone = {
  /** Firmware zone key (main/side/bottom). Used for asset routing — never shown. */
  id: LayoutZoneId
  /** Friendly display name. Defaults to the capitalized id when omitted; set
   *  explicitly where the id is misleading (e.g. a top "Banner" stored as bottom). */
  label?: string
  /** Fractional rect: x, y, w, h all 0..1 (for the diagram only). */
  x: number
  y: number
  w: number
  h: number
}

export type LayoutDef = {
  /** Server template id stored in the playlist's `layout` field. */
  id: string
  name: string
  description: string
  portrait?: boolean
  /** Needs a custom_layout.html asset; templateName is used on the player. */
  custom?: boolean
  /** Marked "(enable in settings)" — needs newLayoutsEnable server-side. */
  needsServerEnable?: boolean
  zones: LayoutZone[]
}

export const LAYOUTS: LayoutDef[] = [
  {
    id: '1',
    name: 'Single Zone Display',
    description: 'main Zone:1280x720',
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: '2a',
    name: 'Two Zones with Main Zone on right',
    description: 'main Zone:960x720, side Zone:320x720',
    zones: [
      { id: 'side', x: 0, y: 0, w: 0.25, h: 1 },
      { id: 'main', x: 0.25, y: 0, w: 0.75, h: 1 },
    ],
  },
  {
    id: '2ap',
    name: 'Single Zone Portrait Mode, Orient clockwise',
    description: 'main Zone:720x1280',
    portrait: true,
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: '2ap270',
    name: 'Single Zone Portrait Mode, Orient anti-clockwise',
    description: 'main Zone:720x1280',
    portrait: true,
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: '2b',
    name: 'Two Zones with Main Zone on left',
    description: 'main Zone:960x720, side Zone:320x720',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.75, h: 1 },
      { id: 'side', x: 0.75, y: 0, w: 0.25, h: 1 },
    ],
  },
  {
    id: '2bp',
    name: 'Two Zones Portrait Mode, Orient clockwise',
    description: 'top Zone:720x540, bottom zone:720x740',
    portrait: true,
    zones: [
      { id: 'main', x: 0, y: 0, w: 1, h: 0.42 },
      { id: 'bottom', x: 0, y: 0.42, w: 1, h: 0.58 },
    ],
  },
  {
    id: '2bp270',
    name: 'Two Zone Portrait Mode, Orient anti-clockwise',
    description: 'top Zone:720x540, bottom zone:720x740',
    portrait: true,
    zones: [
      { id: 'main', x: 0, y: 0, w: 1, h: 0.42 },
      { id: 'bottom', x: 0, y: 0.42, w: 1, h: 0.58 },
    ],
  },
  {
    id: '2c',
    name: 'Two Equal Size Zones with Video Zone on left',
    description: 'main Zone:640x720, side Zone:640x720',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.5, h: 1 },
      { id: 'side', x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: '2d',
    name: 'Two Equal Size Zones with Video Zone on right',
    description: 'main Zone:640x720, side Zone:640x720',
    zones: [
      { id: 'side', x: 0, y: 0, w: 0.5, h: 1 },
      { id: 'main', x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: '3a',
    name: 'Three Zones(full bottom) with Main Zone on right',
    description: 'main Zone:960x540, side Zone:320x540, bottom Zone:1280x180',
    zones: [
      { id: 'side', x: 0, y: 0, w: 0.25, h: 0.75 },
      { id: 'main', x: 0.25, y: 0, w: 0.75, h: 0.75 },
      { id: 'bottom', x: 0, y: 0.75, w: 1, h: 0.25 },
    ],
  },
  {
    id: '3b',
    name: 'Three Zones(full bottom) with Main Zone on left',
    description: 'main Zone:960x540, side Zone:320x540, bottom Zone:1280x180',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.75, h: 0.75 },
      { id: 'side', x: 0.75, y: 0, w: 0.25, h: 0.75 },
      { id: 'bottom', x: 0, y: 0.75, w: 1, h: 0.25 },
    ],
  },
  {
    id: '3c',
    name: 'Three Zones(full top) with Main Zone on right (enable in settings)',
    description: 'main Zone:960x540, side Zone:320x540, banner Zone:1280x180',
    needsServerEnable: true,
    zones: [
      { id: 'bottom', label: 'Banner', x: 0, y: 0, w: 1, h: 0.25 },
      { id: 'side', x: 0, y: 0.25, w: 0.25, h: 0.75 },
      { id: 'main', x: 0.25, y: 0.25, w: 0.75, h: 0.75 },
    ],
  },
  {
    id: '3d',
    name: 'Three Zones(full top) with Main Zone on left (enable in settings)',
    description: 'main Zone:960x540, side Zone:320x540, banner Zone:1280x180',
    needsServerEnable: true,
    zones: [
      { id: 'bottom', label: 'Banner', x: 0, y: 0, w: 1, h: 0.25 },
      { id: 'main', x: 0, y: 0.25, w: 0.75, h: 0.75 },
      { id: 'side', x: 0.75, y: 0.25, w: 0.25, h: 0.75 },
    ],
  },
  {
    id: '4a',
    name: 'Three Zones(full side) with Main Zone on right',
    description: 'main Zone:960x540, side Zone:320x720, bottom Zone:960x180',
    zones: [
      { id: 'side', x: 0, y: 0, w: 0.25, h: 1 },
      { id: 'main', x: 0.25, y: 0, w: 0.75, h: 0.75 },
      { id: 'bottom', x: 0.25, y: 0.75, w: 0.75, h: 0.25 },
    ],
  },
  {
    id: '4b',
    name: 'Three Zones(full side) with Main Zone on left',
    description: 'main Zone:960x540, side Zone:320x720, bottom Zone:960x180',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.75, h: 0.75 },
      { id: 'bottom', x: 0, y: 0.75, w: 0.75, h: 0.25 },
      { id: 'side', x: 0.75, y: 0, w: 0.25, h: 1 },
    ],
  },
  {
    id: '4c',
    name: 'Three Zones(full side) with Main Zone on right (enable in settings)',
    description: 'main Zone:960x540, side Zone:320x720, banner Zone:960x180',
    needsServerEnable: true,
    // "banner" layout: the bottom-id zone is the TOP banner strip.
    zones: [
      { id: 'side', x: 0, y: 0, w: 0.25, h: 1 },
      { id: 'bottom', label: 'Banner', x: 0.25, y: 0, w: 0.75, h: 0.25 },
      { id: 'main', x: 0.25, y: 0.25, w: 0.75, h: 0.75 },
    ],
  },
  {
    id: '4d',
    name: 'Three Zones(full side) with Main Zone on left (enable in settings)',
    description: 'main Zone:960x540, side Zone:320x720, banner Zone:960x180',
    needsServerEnable: true,
    // "banner" layout: the bottom-id zone is the TOP banner strip.
    zones: [
      { id: 'bottom', label: 'Banner', x: 0, y: 0, w: 0.75, h: 0.25 },
      { id: 'main', x: 0, y: 0.25, w: 0.75, h: 0.75 },
      { id: 'side', x: 0.75, y: 0, w: 0.25, h: 1 },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Layout in Landscape Mode (v1.6.0+)',
    description:
      'Upload custom_layout.html under Assets. Use #main, #side, #bottom, #ticker HTML ID tags for content.',
    custom: true,
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'customp',
    name: 'Custom Layout in Portrait Mode, Orient clockwise',
    description:
      'Upload custom_layout.html under Assets. Use #main, #side, #bottom, #ticker HTML ID tags for content.',
    custom: true,
    portrait: true,
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'customp270',
    name: 'Custom Layout in Portrait Mode, Orient anti-clockwise',
    description:
      'Upload custom_layout.html under Assets. Use #main, #side, #bottom, #ticker HTML ID tags for content.',
    custom: true,
    portrait: true,
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
]

export function findLayout(id?: string): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0]
}

/** Non-main zone ids a layout exposes (for zone-file routing / video windows). */
export function otherZoneIds(layout: LayoutDef): Exclude<LayoutZoneId, 'main'>[] {
  return layout.zones
    .map((z) => z.id)
    .filter((id): id is Exclude<LayoutZoneId, 'main'> => id !== 'main')
}

/** Non-main zone objects (id + display label) — for the sequence attach UI. */
export function attachableZones(layout: LayoutDef): LayoutZone[] {
  return layout.zones.filter((z) => z.id !== 'main')
}

/** Friendly display name for a zone: explicit label, else capitalized id. */
export function zoneDisplayLabel(zone: LayoutZone): string {
  return zone.label ?? zone.id.charAt(0).toUpperCase() + zone.id.slice(1)
}
