# pisignage-server-ui

A React + Vite SPA that replaces the legacy AngularJS frontend in
[`pisignage-server`](../pisignage-server). The visual design is the
**Industrial Precision** system from
[`stitch_pisignage_ui_redesign`](../stitch_pisignage_ui_redesign).

## Stack

- Vite + React 19 + TypeScript, mounted at **`/v2`** (Vite `base: '/v2/'`)
- Tailwind CSS v4 (tokens declared in `src/index.css` via `@theme`)
- shadcn-style primitives (`src/components/ui/`) built on Radix
- TanStack Query for server state
- Axios + HTTP Basic Auth (matches the backend's auth model)
- `socket.io-client@^2.4` to talk to the server's `/newsocket.io` v2 transport
- `@dnd-kit/*` for the playlist sequence editor

## Develop

```bash
npm install
npm run dev                     # → http://localhost:5173/v2/

# in another terminal:
cd ../pisignage-server && npm start    # → http://localhost:3000
```

Vite proxies `/api`, `/media`, `/sync_folders`, and `/newsocket.io` (with WS
upgrade) to `http://localhost:3000`. Hit a different backend with:

```bash
PISIGNAGE_API=https://piathome.com:8000 npm run dev
```

> The dev server serves the app from `/v2/` because of the `base` config —
> `localhost:5173/` is empty, `localhost:5173/v2/` is the app.

## Auth

First load redirects to `/login` (i.e. `/v2/login` in production). Credentials
are stored as a Basic Auth header in `sessionStorage` and attached to every
`/api/*` request. A `401` clears the header and bounces back to login.
Defaults to `pi / pi` on a fresh install.

## Production build & deploy (Path B — co-exists with legacy)

The SPA mounts at `/v2`, leaving the AngularJS bundle untouched at `/`.

```bash
# from this directory
npm run deploy:local            # builds → copies dist/ to ../pisignage-server/public/v2/
```

`scripts/deploy-local.mjs` only wipes the `/v2` subdir, so the legacy bundle at
`public/index.html` and the rest of `public/` are safe. Override the target:

```bash
PISIGNAGE_SERVER=/path/to/pisignage-server npm run deploy:local
```

Then restart pisignage-server (or wait for nodemon) and hit
`http://<host>:<port>/v2/`.

### One-time server change

`pisignage-server/config/express.js` needs an SPA fallback so client-side
routes like `/v2/players` don't 404 on direct hit. The block landed in place
during the v1 setup:

```js
app.get(/^\/v2(\/.*)?$/, function (req, res, next) {
    if (path.extname(req.path)) return next();
    res.sendFile(path.join(config.root, 'public', 'v2', 'index.html'));
});
```

The static `express.static('public')` line above it serves real built files;
this fallback only fires when nothing matched and the request looks like a
client-side route.

### Cutting over to Path A (replace legacy UI)

When you're ready to retire the AngularJS bundle:

```bash
# from this directory
npm run build
rm -rf ../pisignage-server/public/v2 ../pisignage-server/public/app   # back up first
cp -r dist/* ../pisignage-server/public/
```

Drop `base: '/v2/'` from `vite.config.ts` first so assets resolve from `/`.
The `BrowserRouter` basename auto-follows `import.meta.env.BASE_URL`.

## Layout

```
src/
├── lib/                # api client, auth helpers, socket hook, types per domain
│   ├── envelope.ts     # tolerates pisignage's varied response shapes
│   ├── players.ts, groups.ts, assets.ts, playlists.ts, labels.ts, settings.ts
│   ├── layouts.ts      # 6 hardcoded zone templates
│   └── socket.ts       # /newsocket.io subscriber hook
├── components/
│   ├── ui/             # shadcn primitives (Button, Card, Badge, Dialog, …)
│   ├── layout/         # SideNav, TopBar, AppShell
│   ├── ErrorBoundary.tsx
│   ├── Icon.tsx        # Material Symbols wrapper
│   └── StatusBadge.tsx
├── pages/
│   ├── Dashboard, Players, Groups, Assets, Playlists, Settings, Login
│   └── playlist/       # SequenceSection, LayoutSection, SettingsSection
└── App.tsx             # router (basename from import.meta.env.BASE_URL) + QueryClient + auth guard
```

## Status

- App shell + dark Industrial Precision theme — done
- Login + Basic Auth flow with 401 handling — done
- Dashboard, Players, Groups, Assets, Playlists list + editor, Settings — done
- Live updates via `/newsocket.io` `status` events — done
- Deploy at `/v2` co-existing with legacy AngularJS — done

## Known limitations

- **Snapshots** assume `/media/snapshots/<player_id>.jpg`; falls back to a
  placeholder if the file 404s. Some forks use `cpuSerialNumber` — easy to
  swap in `Players.tsx`.
- **Playlist zone routing** uses a `zone` field on `asset.option`; the live
  server stores `option: { main: boolean, side: boolean, ... }`. The editor
  reads/writes this defensively but multi-zone display may be approximate.
- **Pagination** on `/api/players` is not consumed yet — fine while
  `pages: 1`, will need surfacing when fleets grow.
- **Tailwind v4** plugin animations are not wired; dialogs/dropdowns pop
  without easing. Cosmetic only.
