import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const MAILHOG_BASE =
  process.env.MAILHOG_API_BASE || 'http://127.0.0.1:8025'
const E2E_HS = process.env.E2E_LOCAL_HOMESERVER || 'http://127.0.0.1:8008'
const E2E_PASSWORD = process.env.E2E_SIGNUP_PASSWORD || 'E2eSignup!Pass9z'

/**
 * Picks a confirmation URL from MailHog (Synapse or app).
 * @param {string} [emailNeedle]
 * @returns {Promise<string | null>}
 */
async function firstVerificationUrlFromMailhog(emailNeedle) {
  const listResponse = await fetch(`${MAILHOG_BASE}/api/v2/messages`)
  if (!listResponse.ok) {
    return null
  }
  const listData = await listResponse.json()
  const items = listData?.items && Array.isArray(listData.items)
    ? listData.items
    : []
  for (const item of items) {
    const toHeader = item?.Content?.Headers?.To
    const toText = Array.isArray(toHeader) ? toHeader.join(' ') : ''
    if (emailNeedle && !toText.includes(emailNeedle)) {
      continue
    }
    const raw = (
      (item?.MIME && JSON.stringify(item.MIME)) ||
      item?.Content?.Body ||
      ''
    )
    const s = String(raw)
    const hrefMatch = /href="(https?:[^"]+)"/i.exec(s)
    if (hrefMatch) {
      return hrefMatch[1]
        .replace(/&amp;/g, '&')
    }
    const plain = s.match(
      /https?:\/\/127\.0\.0\.1:8008[^\s"'<>)]+/i
    )
    if (plain) {
      return plain[0]
    }
  }
  return null
}

/**
 * @param {string} [emailNeedle]
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
async function waitForVerificationUrl(emailNeedle, timeoutMs = 120000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const found = await firstVerificationUrlFromMailhog(emailNeedle)
    if (found) {
      return found
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2000))
  }
  throw new Error('Timed out waiting for MailHog registration email')
}

When('I self-register with a new address on the e2e homeserver', async function () {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  this.signupEmail = `e2e-${unique}@localhost`
  this.signupLocalpart = `e2euser${unique.replace(/[^a-z0-9]/gi, 'x')}`
    .slice(0, 20)
  await this.page.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' })
  await this.page.getByLabel(/Email|E-Mail/i).first()
    .fill(this.signupEmail)
  await this.page.getByLabel(/Homeserver|Homeserver-URL/i).first()
    .fill(E2E_HS)
  await this.page.getByLabel(/Username|Benutzername/i).first()
    .fill(this.signupLocalpart)
  await this.page.getByLabel(/Password|Passwort/i).first()
    .fill(E2E_PASSWORD)
  await this.page.getByRole('button', { name: /Sign up|Registrieren/i })
    .last()
    .click()
})

Then('I should see the check-your-email step', async function () {
  await expect(
    this.page.getByText(/Check your email|We sent|check your e-mail|Prüf/i)
  )
    .toBeVisible({ timeout: 120000 })
})

When('I complete verification from MailHog and the app', async function () {
  const emailNeedle = this.signupEmail || ''
  const linkFromMail = await waitForVerificationUrl(emailNeedle, 120000)
  await this.page.goto(linkFromMail, { waitUntil: 'domcontentloaded' })
  const origin = new URL(BASE_URL).origin
  await this.page.goto(
    `${origin}/signup/verify-email`,
    { waitUntil: 'domcontentloaded' }
  )
  await this.page.waitForURL(
    (url) => {
      return url.pathname === '/login' &&
        url.searchParams.get('signup') === 'success'
    },
    { timeout: 120000 }
  )
})

Then('I should see successful signup on the login page', async function () {
  await expect(
    this.page.getByText(/Account created|Konto erstellt/i)
  )
    .toBeVisible({ timeout: 30000 })
})
