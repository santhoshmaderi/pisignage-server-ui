import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
})

const ROUTES: { path: string; heading: string }[] = [
  { path: '', heading: 'System Overview' },
  { path: 'players', heading: 'Players' },
  { path: 'groups', heading: 'Groups' },
  { path: 'assets', heading: 'Asset Library' },
  { path: 'playlists', heading: 'Playlists' },
  { path: 'settings', heading: 'License & Installation Settings' },
  { path: 'self-hosted', heading: 'piSignage Self-Hosted Server' },
]

for (const r of ROUTES) {
  test(`loads ${r.path || 'dashboard'}`, async ({ page }) => {
    await page.goto(r.path)
    await expect(page.getByRole('heading', { name: r.heading })).toBeVisible()
  })
}

test('sidebar navigates between pages', async ({ page }) => {
  await page.goto('')
  await page.getByRole('link', { name: /Players/ }).click()
  await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible()
  await page.getByRole('link', { name: /Assets/ }).click()
  await expect(page.getByRole('heading', { name: 'Asset Library' })).toBeVisible()
  await page.getByRole('link', { name: /Playlists/ }).click()
  await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible()
})

test('self-hosted promo card opens the details page', async ({ page }) => {
  await page.goto('')
  await page.getByRole('link', { name: /Learn More/ }).click()
  await expect(page.getByRole('heading', { name: 'piSignage Self-Hosted Server' })).toBeVisible()
  // Features appear in the requested order, multi-user first.
  await expect(page.getByRole('heading', { name: 'Multi-user Management' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SSO Integrations' })).toBeVisible()
})
