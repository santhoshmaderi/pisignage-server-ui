import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
  await page.goto('players')
  await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible()
})

test('toolbar shows search and status filters', async ({ page }) => {
  await expect(page.getByPlaceholder(/Search name, IP, group/i)).toBeVisible()
  for (const label of ['All', 'Online', 'Offline']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
})

test('status filter pills are clickable', async ({ page }) => {
  await page.getByRole('button', { name: 'Online', exact: true }).click()
  await page.getByRole('button', { name: 'Offline', exact: true }).click()
  await page.getByRole('button', { name: 'All', exact: true }).click()
  // No assertion on counts (data-dependent) — this verifies the controls work.
})
