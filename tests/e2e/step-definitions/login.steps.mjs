import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function requireEnv(variableName) {
  const variableValue = process.env[variableName]
  if (!variableValue) {
    throw new Error(`Missing required E2E env: ${variableName}`)
  }
  return variableValue
}

async function submitLogin(page, homeserverValue, usernameValue, passwordValue) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/Homeserver|Homeserver-URL/i).fill(homeserverValue)
  await page.getByLabel(/Username|Benutzername/i).fill(usernameValue)
  await page.getByLabel(/Password|Passwort/i).fill(passwordValue)
  await page.getByRole('button', { name: /Sign in|Anmelden/i }).click()
  await expect(page).toHaveURL(/\/chat/, { timeout: 45000 })
}

When('I open the login page', async function () {
  await this.page.goto(`${BASE_URL}/login`)
})

When(
  'I log in with {string} and {string}',
  async function (username, password) {
    await this.page.getByLabel(/Username|Benutzername/i).fill(username)
    await this.page.getByLabel(/Password|Passwort/i).fill(password)
    await this.page.getByRole('button', { name: /Sign in|Anmelden/i }).click()
  }
)

Given('valid e2e credentials are configured', async function () {
  const requiredKeys = [
    'E2E_MATRIX_USERNAME',
    'E2E_MATRIX_PASSWORD'
  ]
  const missingKeys = requiredKeys.filter((key) => !process.env[key])

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing E2E credentials: ${missingKeys.join(', ')}. `
      + 'Create tests/e2e/.env.e2e.local from tests/e2e/.env.e2e.example.'
    )
  }
})

When('I log in with configured credentials', async function () {
  const homeserverValue = process.env.E2E_MATRIX_HOMESERVER || 'https://matrix.org'
  const usernameValue = process.env.E2E_MATRIX_USERNAME || ''
  const passwordValue = process.env.E2E_MATRIX_PASSWORD || ''

  await this.page.getByLabel(/Homeserver|Homeserver-URL/i).fill(homeserverValue)
  await this.page.getByLabel(/Username|Benutzername/i).fill(usernameValue)
  await this.page.getByLabel(/Password|Passwort/i).fill(passwordValue)
  await this.page.getByRole('button', { name: /Sign in|Anmelden/i }).click()
})

When('I sign in with configured credentials', async function () {
  const homeserverValue = requireEnv('E2E_MATRIX_HOMESERVER')
  const usernameValue = requireEnv('E2E_MATRIX_USERNAME')
  const passwordValue = requireEnv('E2E_MATRIX_PASSWORD')
  await submitLogin(this.page, homeserverValue, usernameValue, passwordValue)
})

When('I sign in with secondary configured credentials', async function () {
  const homeserverValue = requireEnv('E2E_MATRIX_HOMESERVER')
  const usernameValue = requireEnv('E2E_SECOND_MATRIX_USERNAME')
  const passwordValue = requireEnv('E2E_SECOND_MATRIX_PASSWORD')
  await submitLogin(this.page, homeserverValue, usernameValue, passwordValue)
})

Then('I should see the login form', async function () {
  await expect(this.page.getByRole('heading', { name: /Sign in|Anmelden/i }))
    .toBeVisible()
})

Then('an error message should appear', async function () {
  await expect(this.page.getByText(/fehlgeschlagen|error|invalid/i))
    .toBeVisible({ timeout: 5000 })
})

Then('I should be redirected to the chat page', async function () {
  await expect(this.page).toHaveURL(/\/chat/)
})
