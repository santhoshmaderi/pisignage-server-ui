import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
  await page.goto('playlists')
  await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible()
})

test('New Playlist opens a create dialog', async ({ page }) => {
  await page.getByRole('button', { name: /New Playlist|Create First Playlist/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('New Playlist')
})

test('rejects an invalid playlist name', async ({ page }) => {
  await page.getByRole('button', { name: /New Playlist|Create First Playlist/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('bad/name*!')
  await dialog.getByRole('button', { name: /Create Playlist/ }).click()
  // Stays open with an inline validation error (no playlist created).
  await expect(dialog.getByRole('alert')).toBeVisible()
})
