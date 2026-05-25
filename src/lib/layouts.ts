/**
 * Hardcoded zone layouts that pisignage-server supports out of the box.
 *
 * Zone coordinates are normalized to a 0..1 fraction of the screen so we
 * can render the diagram at any size. Zone IDs match the keys pisignage
 * uses in `playlist.zoneVideoWindow` / asset routing on the player.
 */
export type LayoutZone = {
  id: 'main' | 'side' | 'bottom' | 'top'
  /** Fractional rect: x, y, w, h all 0..1. */
  x: number
  y: number
  w: number
  h: number
}

export type LayoutDef = {
  /** Server-side template id used in playlist JSON's `layout` field. */
  id: string
  name: string
  description: string
  /** True if this layout is portrait-oriented. */
  portrait?: boolean
  zones: LayoutZone[]
}

export const LAYOUTS: LayoutDef[] = [
  {
    id: '1',
    name: 'Single Zone',
    description: 'One fullscreen region. The default for most signage.',
    zones: [{ id: 'main', x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: '2a',
    name: 'Main + Side',
    description: 'Primary content left, sidebar right. Good for live data or menus.',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.7, h: 1 },
      { id: 'side', x: 0.7, y: 0, w: 0.3, h: 1 },
    ],
  },
  {
    id: '2b',
    name: 'Main + Bottom',
    description: 'Hero content on top, a stripe below for ticker assets or branding.',
    zones: [
      { id: 'main', x: 0, y: 0, w: 1, h: 0.78 },
      { id: 'bottom', x: 0, y: 0.78, w: 1, h: 0.22 },
    ],
  },
  {
    id: '2ap',
    name: 'Portrait Stacked',
    description: 'Portrait orientation: main on top, secondary below.',
    portrait: true,
    zones: [
      { id: 'main', x: 0, y: 0, w: 1, h: 0.7 },
      { id: 'bottom', x: 0, y: 0.7, w: 1, h: 0.3 },
    ],
  },
  {
    id: '3a',
    name: 'Main + Side + Bottom',
    description: 'Three-zone layout for richer dashboards.',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.7, h: 0.78 },
      { id: 'side', x: 0.7, y: 0, w: 0.3, h: 0.78 },
      { id: 'bottom', x: 0, y: 0.78, w: 1, h: 0.22 },
    ],
  },
  {
    id: '3b',
    name: 'Main + Top + Side',
    description: 'Wider top stripe with a primary canvas and side rail.',
    zones: [
      { id: 'top', x: 0, y: 0, w: 1, h: 0.22 },
      { id: 'main', x: 0, y: 0.22, w: 0.7, h: 0.78 },
      { id: 'side', x: 0.7, y: 0.22, w: 0.3, h: 0.78 },
    ],
  },
  {
    id: '4a',
    name: 'Quad',
    description: 'Four equal quadrants — multi-feed video walls.',
    zones: [
      { id: 'main', x: 0, y: 0, w: 0.5, h: 0.5 },
      { id: 'side', x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { id: 'bottom', x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { id: 'top', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
]

export function findLayout(id?: string): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0]
}
