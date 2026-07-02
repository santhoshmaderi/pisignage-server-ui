import { test, expect } from '@playwright/test'
import { seedAuth } from './helpers'

test.beforeEach(async ({ page }) => {
  await seedAuth(page)
  await page.goto('groups')
  await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible()
})

test('New Group opens a create dialog with a name field', async ({ page }) => {
  await page.getByRole('button', { name: 'New Group' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('New Group')).toBeVisible()
  await expect(dialog.getByRole('textbox')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('opening a group shows the action pills', async ({ page }) => {
  const groupHeadings = page.getByRole('heading', { level: 3 })
  if ((await groupHeadings.count()) === 0) {
    test.skip(true, 'No groups exist to open')
  }
  await groupHeadings.first().click()
  await expect(page.getByRole('button', { name: 'Group Ticker' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Group Settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Emergency Message' })).toBeVisible()
})

test('Group Ticker dialog opens from group detail', async ({ page }) => {
  const groupHeadings = page.getByRole('heading', { level: 3 })
  if ((await groupHeadings.count()) === 0) test.skip(true, 'No groups exist to open')
  await groupHeadings.first().click()
  await page.getByRole('button', { name: 'Group Ticker' }).click()
  await expect(page.getByRole('dialog')).toContainText('Group Ticker Configuration')
})
