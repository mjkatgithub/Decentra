import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const E2E_HS = process.env.E2E_LOCAL_HOMESERVER || 'http://127.0.0.1:8008'
const E2E_PASSWORD = process.env.E2E_SIGNUP_PASSWORD || 'E2eSignup!Pass9z'

Given('I open the signup page for recaptcha e2e', async function () {
  await this.page.goto(`${BASE_URL}/signup`, {
    waitUntil: 'domcontentloaded'
  })
})

When('I submit signup against captcha-enabled synapse', async function () {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  this.signupEmail = `e2e-${unique}@localhost`
  this.signupLocalpart = `e2erc${unique.replace(/[^a-z0-9]/gi, 'x')}`
    .slice(0, 20)
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

Then('I should see the signup captcha step', async function () {
  await expect(
    this.page.getByRole('heading', {
      name: /Verify you are human|Bestaetigung gegen Bots|Mensch/i
    })
  ).toBeVisible({ timeout: 120000 })
})

When('I consent and solve the signup recaptcha challenge', async function () {
  await this.page.getByRole('button', {
    name: /Agree and load reCAPTCHA|Zustimmen und reCAPTCHA laden/i
  }).click()
  const anchorSelector = 'iframe[src*="google.com/recaptcha/api2/anchor"]'
  await this.page.locator(anchorSelector).first().waitFor({
    state: 'visible',
    timeout: 90000
  })
  const anchorFrame = this.page.frameLocator(anchorSelector).first()
  await anchorFrame.locator('#recaptcha-anchor').click({
    timeout: 90000
  })
})

Then('I should land on login after captcha signup success', async function () {
  await this.page.waitForURL(
    (url) => {
      return url.pathname === '/login' &&
        url.searchParams.get('signup') === 'success'
    },
    { timeout: 120000 }
  )
  await expect(
    this.page.getByText(/Account created|Konto erstellt/i)
  ).toBeVisible({ timeout: 30000 })
})
