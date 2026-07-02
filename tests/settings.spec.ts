import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
  await page.goto('settings')
})

test('renders the license and installation sections', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'License & Installation Settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Available Licenses/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Installation Settings', exact: true })).toBeVisible()
})

test('shows the system behaviors and advanced config', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'System Behaviors' })).toBeVisible()
  await expect(page.getByText('Username at pisignage.com')).toBeVisible()
  await expect(page.getByText(/Reset to Default Behaviors/)).toBeVisible()
})
