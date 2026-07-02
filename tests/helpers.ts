import { type Page, expect } from '@playwright/test'

/** sessionStorage key the app reads its HTTP Basic auth header from (lib/auth.ts). */
export const AUTH_KEY = 'pisignage.basicAuth'

/**
 * Seed the Basic-auth header into sessionStorage before any app code runs, so
 * RequireAuth lets the page through without the login UI. Playwright's
 * storageState does NOT persist sessionStorage, so we inject it per page.
 * Call BEFORE the first `page.goto`.
 */
export async function seedAuth(page: Page, user = 'pi', password = 'pi') {
  await page.addInitScript(
    ([key, u, p]) => {
      sessionStorage.setItem(key, 'Basic ' + btoa(`${u}:${p}`))
    },
    [AUTH_KEY, user, password] as const,
  )
}

/** Log in through the actual UI form (exercises the login flow). */
export async function loginViaUI(page: Page, user = 'pi', password = 'pi') {
  await page.goto('login')
  await page.getByLabel('Username').fill(user)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  // RequireAuth redirects to the dashboard; the sidebar brand is always present.
  await expect(page.getByRole('heading', { name: 'piSignage' })).toBeVisible()
}
