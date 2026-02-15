import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

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

Then('I should see the login form', async function () {
  await expect(this.page.getByRole('heading', { name: /Sign in|Anmelden/i }))
    .toBeVisible()
})

Then('an error message should appear', async function () {
  await expect(this.page.getByText(/fehlgeschlagen|error|invalid/i))
    .toBeVisible({ timeout: 5000 })
})
