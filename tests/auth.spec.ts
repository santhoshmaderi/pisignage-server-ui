import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers'

test.describe('Authentication', () => {
  test('unauthenticated visit redirects to login', async ({ page }) => {
    await page.goto('players')
    await expect(page.getByRole('heading', { name: 'piSignage Server' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('shows a validation error when password is empty', async ({ page }) => {
    await page.goto('login')
    await page.getByLabel('Username').fill('pi')
    await page.getByLabel('Password').fill('')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('alert')).toContainText(/required/i)
  })

  test('logs in with pi/pi and reaches the console', async ({ page }) => {
    await loginViaUI(page, 'pi', 'pi')
    await expect(page.getByRole('link', { name: /Players/ })).toBeVisible()
  })
})
