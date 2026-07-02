import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
  await page.goto('assets')
  await expect(page.getByRole('heading', { name: 'Asset Library' })).toBeVisible()
})

test('opens the upload dialog', async ({ page }) => {
  await page.getByRole('button', { name: /Upload Files/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Upload Media')
  await page.keyboard.press('Escape')
})

test('Add a Link from the upload menu opens the link dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'More upload options' }).click()
  await page.getByRole('menuitem', { name: /Add a Link/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Add a Link')
  await expect(dialog.getByText('File Type')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('Add a Message opens the message form', async ({ page }) => {
  await page.getByRole('button', { name: 'More upload options' }).click()
  await page.getByRole('menuitem', { name: /Add a Message/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Add a Message')
  await page.keyboard.press('Escape')
})

test('toggles between list and grid views', async ({ page }) => {
  await page.getByRole('button', { name: 'Grid view' }).click()
  await page.getByRole('button', { name: 'List view' }).click()
})
