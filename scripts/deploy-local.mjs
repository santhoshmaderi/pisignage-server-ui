#!/usr/bin/env node
/**
 * Copy the built SPA into the sibling pisignage-server's public/v2/ directory.
 *
 * Usage:
 *   PISIGNAGE_SERVER=../pisignage-server npm run deploy:local
 *
 * Defaults to ../pisignage-server when PISIGNAGE_SERVER is unset.
 * Wipes only the target /v2/ subdir, never touches the legacy bundle at
 * public/index.html.
 */
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'

const here = process.cwd()
const dist = join(here, 'dist')
const targetRoot = resolve(here, process.env.PISIGNAGE_SERVER ?? '../pisignage-server')
const target = join(targetRoot, 'public', 'v2')

if (!existsSync(dist)) {
  console.error(`✗ No dist/ at ${dist} — run "npm run build" first.`)
  process.exit(1)
}

if (!existsSync(targetRoot)) {
  console.error(
    `✗ pisignage-server not found at ${targetRoot}.\n` +
      `  Set PISIGNAGE_SERVER=/path/to/pisignage-server and try again.`,
  )
  process.exit(1)
}

if (!existsSync(join(targetRoot, 'public'))) {
  console.error(`✗ ${targetRoot} does not look like pisignage-server (no public/).`)
  process.exit(1)
}

// Wipe and recopy. We only touch the /v2 subdir.
if (existsSync(target)) rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(dist, target, { recursive: true })

console.log(`✓ Deployed → ${target}`)
console.log('  Hit http://<server>:<port>/v2/ once the server is restarted.')
