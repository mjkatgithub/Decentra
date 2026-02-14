import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

When('I open the chat page', async function () {
  await this.page.goto(`${BASE_URL}/chat`)
})

Then('{string} should be displayed', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 })
})

Then('I am redirected to the login page', async function () {
  await expect(this.page).toHaveURL(/\/login/)
  await expect(this.page.getByRole('heading', { name: /Anmelden/i }))
    .toBeVisible()
})
