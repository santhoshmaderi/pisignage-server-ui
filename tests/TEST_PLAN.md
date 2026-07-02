# piSignage v2 UI — Test Plan

Manual + automated test scenarios for the open-source UI served at
`http://localhost:3000/v2/`. Login is **pi / pi** on a fresh install.

- **Tool:** Playwright (`@playwright/test`). See `tests/README.md` to run.
- **Pre-req:** pisignage-open-server running on :3000 with the v2 build deployed
  (`npm run deploy:local`), and ideally at least one registered player and one
  asset so data-dependent flows have something to act on.

Legend: ⚙️ has an automated spec · 📝 manual-only (mutates data / needs hardware).

---

## 1. Authentication (`auth.spec.ts`)
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1.1 ⚙️ | Unauthenticated redirect | Open `/v2/players` with no session | Redirected to login ("piSignage Server", Sign In) |
| 1.2 ⚙️ | Required-field validation | Login page → clear password → Sign In | Inline alert "Username and password are required." |
| 1.3 ⚙️ | Login with pi/pi | Enter pi / pi → Sign In | Lands on console; sidebar + nav visible |
| 1.4 📝 | Wrong password | Enter pi / wrong → Sign In | First API call 401s → bounced back to login |
| 1.5 📝 | Sign out | Top bar → Sign out | Session cleared, back to login |

## 2. Navigation & shell (`navigation.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 2.1 ⚙️ | Dashboard loads | Heading "System Overview" |
| 2.2 ⚙️ | Players loads | Heading "Players" |
| 2.3 ⚙️ | Groups loads | Heading "Groups" |
| 2.4 ⚙️ | Assets loads | Heading "Asset Library" |
| 2.5 ⚙️ | Playlists loads | Heading "Playlists" |
| 2.6 ⚙️ | Settings loads | Heading "License & Installation Settings" |
| 2.7 ⚙️ | Sidebar nav | Clicking nav items routes to each page |
| 2.8 ⚙️ | Self-Hosted card | "Learn More" → details page ("piSignage Self-Hosted Server"), feature list |

## 3. Dashboard
| # | Scenario | Expected |
|---|---|---|
| 3.1 📝 | Stat cards | Total/online/offline counts render from `/api/players` |
| 3.2 📝 | Live telemetry | Player cards / event log populate when data exists |

## 4. Players (`players.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 4.1 ⚙️ | Page + toolbar | Heading, search box, group filter, All/Online/Offline pills |
| 4.2 ⚙️ | Status filter | Clicking Online/Offline/All filters the grid |
| 4.3 📝 | Search | Typing a name/IP narrows the cards |
| 4.4 📝 | Card fields | Player ID (4-grouped), IP, MAC, uptime (human), temp °C/°F, disk |
| 4.5 📝 | Pi Shell terminal | ⋮/terminal → run `uptime`; TV On/Off, Reboot, Show Logs; ↑ recalls history |
| 4.6 📝 | Rename | ⋮ → Rename → save → card name updates |
| 4.7 📝 | Change Group | ⋮ → Change Group → pick group → Move; player re-syncs |
| 4.8 📝 | Refresh Snapshot / Restart / Update / Delete | Confirm dialogs; actions issued |

## 5. Groups (`groups.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 5.1 ⚙️ | Page + New Group | Heading "Groups", New Group button |
| 5.2 ⚙️ | Create dialog | New Group → dialog with name field; Cancel closes |
| 5.3 ⚙️ | Open detail | Click a group → action pills (Group Ticker, Group Settings, Emergency Message) |
| 5.4 📝 | Group Ticker | Enable "Show", set message, Save → reopen stays enabled (pill highlights) |
| 5.5 📝 | Group Settings | All legacy fields present; change resolution/clock → Save persists |
| 5.6 📝 | Emergency Message | Enable + message → Save; pill turns red |
| 5.7 📝 | Default + additional playlists | Assign playlists; schedule table updates |
| 5.8 📝 | Deploy | Deploy → "Deployed to {group}" or surfaced error ("No Players associated") |
| 5.9 📝 | Rename / Delete | ⋮ actions; default group not deletable |

## 6. Assets (`assets.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 6.1 ⚙️ | Page loads | Heading "Asset Library" |
| 6.2 ⚙️ | Upload dialog | "Upload Files" → "Upload Media" dialog |
| 6.3 ⚙️ | Add a Link | caret → Add a Link → link dialog (File Type select) |
| 6.4 ⚙️ | Add a Message | caret → Add a Message → message form |
| 6.5 ⚙️ | List/Grid toggle | Switch views; preference persists |
| 6.6 📝 | Upload file | Drop/select file → appears after processing |
| 6.7 📝 | Edit link | weblink row → Edit (not download) → values prefilled → Save |
| 6.8 📝 | Delete / bulk delete | Single delete confirm; select rows → Delete selected |
| 6.9 📝 | Labels filter | Sidebar label filters the grid |

## 7. Playlists (`playlists.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 7.1 ⚙️ | Page loads | Heading "Playlists" |
| 7.2 ⚙️ | Create validation | New Playlist → invalid name → inline error |
| 7.3 📝 | Create + open editor | Valid name → created → opens editor |
| 7.4 📝 | Sequence | Drag asset onto timeline; video gets real duration (not 10s) |
| 7.5 📝 | Layout / Settings tabs | Switch layout; ticker/audio settings |
| 7.6 📝 | Save | Save Playlist persists |
| 7.7 📝 | Delete | Delete confirm; removed from list |

## 8. Settings
| # | Scenario | Expected |
|---|---|---|
| 8.1 ⚙️ | Page loads | Heading "License & Installation Settings" |
| 8.2 📝 | Field saves | Username/SSH/duration/interval per-row Save → persists |
| 8.3 📝 | Behaviors | Toggles auto-save; Reset to Default Behaviors |
| 8.4 📝 | Download Access | Save updates session (no logout) |
| 8.5 📝 | Licenses | Upload/select/delete license files |

## 9. Self-Hosted (`navigation.spec.ts`)
| # | Scenario | Expected |
|---|---|---|
| 9.1 ⚙️ | Details page | Features in order: Multi-user, Branding, Templates, White-label, SSO, Reseller… |
| 9.2 📝 | External links | "Learn More"/"Visit pisignage.com" open pisignage.com in new tab |

## 10. Cross-cutting
| # | Scenario | Expected |
|---|---|---|
| 10.1 📝 | Backend unreachable | Stop server → pages show "Backend unreachable" cards, no crash |
| 10.2 📝 | 401 handling | Expired/changed creds → redirected to login |
| 10.3 📝 | Responsive | Sidebar/grids reflow on narrow widths |
