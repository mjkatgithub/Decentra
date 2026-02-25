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

Given('seeded synapse env is configured', async function () {
  const requiredKeys = [
    'E2E_MATRIX_HOMESERVER',
    'E2E_MATRIX_USERNAME',
    'E2E_MATRIX_PASSWORD',
    'E2E_SECOND_MATRIX_USERNAME',
    'E2E_SECOND_MATRIX_PASSWORD'
  ]

  for (const requiredKey of requiredKeys) {
    requireEnv(requiredKey)
  }
})

When('I sign in with secondary configured credentials', async function () {
  const homeserverValue = requireEnv('E2E_MATRIX_HOMESERVER')
  const usernameValue = requireEnv('E2E_SECOND_MATRIX_USERNAME')
  const passwordValue = requireEnv('E2E_SECOND_MATRIX_PASSWORD')
  await submitLogin(this.page, homeserverValue, usernameValue, passwordValue)
})

When('I sign in with configured credentials', async function () {
  const homeserverValue = requireEnv('E2E_MATRIX_HOMESERVER')
  const usernameValue = requireEnv('E2E_MATRIX_USERNAME')
  const passwordValue = requireEnv('E2E_MATRIX_PASSWORD')
  await submitLogin(this.page, homeserverValue, usernameValue, passwordValue)
})

When('I open the seeded test room', async function () {
  const seededRoomName = process.env.E2E_TEST_ROOM_NAME || 'Decentra E2E Room'
  const roomButton = this.page
    .getByRole('button', { name: new RegExp(seededRoomName, 'i') })
    .first()
  await expect(roomButton).toBeVisible({ timeout: 20000 })
  await roomButton.click()
})

Then('I should see message body {string}', async function (messageText) {
  await expect(this.page.getByText(messageText, { exact: false }).first())
    .toBeVisible({ timeout: 20000 })
})

Then('I should see an undecryptable fallback notice', async function () {
  await expect(
    this.page.getByText(/encrypted message that could not be decrypted/i).first()
  ).toBeVisible({ timeout: 20000 })
})

Then('I should see image preview for {string}', async function (altLabel) {
  const previewImage = this.page.locator(`img[alt="${altLabel}"]`).first()
  await expect(previewImage).toBeVisible({ timeout: 20000 })
})

When('I open the image preview for {string}', async function (altLabel) {
  const previewImage = this.page.locator(`img[alt="${altLabel}"]`).first()
  await expect(previewImage).toBeVisible({ timeout: 20000 })
  await previewImage.click()
})

Then('the lightbox should be visible', async function () {
  await expect(this.page.locator('img[alt="Full size"]').first())
    .toBeVisible({ timeout: 10000 })
})

When('I close the lightbox with the close button', async function () {
  const closeButton = this.page.locator('div.fixed.inset-0 button').first()
  await expect(closeButton).toBeVisible({ timeout: 10000 })
  await closeButton.click()
})

Then('the lightbox should not be visible', async function () {
  await expect(this.page.locator('img[alt="Full size"]')).toHaveCount(0)
})

Then('I should see image fallback label {string}', async function (fallbackLabel) {
  await expect(this.page.getByText(fallbackLabel, { exact: false }).first())
    .toBeVisible({ timeout: 20000 })
})

When('I click reply on message body {string}', async function (messageText) {
  const messageItem = this.page.locator('div.group').filter({
    hasText: messageText
  }).first()
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await messageItem.hover()
  const replyButton = messageItem
    .getByRole('button', { name: /Reply|Antworten/i })
    .first()
  await expect(replyButton).toBeVisible({ timeout: 10000 })
  await replyButton.click()
})

Then(
  'I should see the reply composer with preview {string}',
  async function (previewText) {
    await expect(this.page.getByText(previewText, { exact: false }).first())
      .toBeVisible({ timeout: 10000 })
    await expect(
      this.page.getByRole('button', { name: /Cancel reply|Antwort abbrechen/i })
    ).toBeVisible({ timeout: 10000 })
  }
)

When('I cancel reply mode', async function () {
  await this.page
    .getByRole('button', { name: /Cancel reply|Antwort abbrechen/i })
    .click()
})

Then('reply mode should be inactive', async function () {
  await expect(
    this.page.getByRole('button', { name: /Cancel reply|Antwort abbrechen/i })
  ).toHaveCount(0)
})

Then('I should see a rendered reply for {string}', async function (bodyText) {
  const replyContainer = this.page.locator('div.group').filter({
    hasText: bodyText
  }).first()
  await expect(replyContainer.locator('.reply-preview')).toBeVisible({
    timeout: 10000
  })
})

Then('I should see a missing-origin reply fallback', async function () {
  await expect(this.page.getByText('Original message unavailable.').first())
    .toBeVisible({ timeout: 10000 })
})
