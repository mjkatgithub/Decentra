import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function normalizePresenceValue(presenceValue) {
  const normalizedPresence = presenceValue.trim().toLowerCase()
  if (normalizedPresence === 'online') {
    return 'online'
  }
  if (normalizedPresence === 'away') {
    return 'unavailable'
  }
  if (normalizedPresence === 'offline') {
    return 'offline'
  }
  throw new Error(`Unsupported presence value: ${presenceValue}`)
}

function expectedPresenceDotClass(presenceValue) {
  const normalizedPresence = presenceValue.trim().toLowerCase()
  if (normalizedPresence === 'online') {
    return 'bg-green-500'
  }
  if (normalizedPresence === 'away') {
    return 'bg-amber-500'
  }
  if (normalizedPresence === 'offline') {
    return 'bg-gray-500'
  }
  throw new Error(`Unsupported presence value: ${presenceValue}`)
}

function currentUserNameNeedle() {
  const configuredUserId = process.env.E2E_MATRIX_USERNAME
  if (!configuredUserId) {
    throw new Error('Missing required E2E env: E2E_MATRIX_USERNAME')
  }
  if (!configuredUserId.includes(':')) {
    return configuredUserId.replace('@', '')
  }
  return configuredUserId.split(':')[0]?.replace('@', '') || configuredUserId
}

function messageContainerByBody(page, messageText) {
  return page.locator('div.group').filter({
    hasText: messageText
  }).first()
}

When('I open the chat page', async function () {
  await this.page.goto(`${BASE_URL}/chat`)
})

When('I open the account settings page', async function () {
  await this.page.goto(`${BASE_URL}/settings/account`)
})

When('I open the space settings page for {string}', async function (spaceId) {
  await this.page.goto(`${BASE_URL}/settings/space/${spaceId}`)
})

Then('{string} should be displayed', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 })
})

Then('I am redirected to the login page', async function () {
  await expect(this.page).toHaveURL(/\/login/)
  await expect(this.page.getByRole('heading', { name: /Sign in|Anmelden/i }))
    .toBeVisible()
})

Then('I am redirected to the root page', async function () {
  await expect(this.page).toHaveURL(/\/$/)
})

When('I reload the current page', async function () {
  await this.page.reload()
})

When('I clear the stored matrix session', async function () {
  await this.page.evaluate(() => {
    window.localStorage.removeItem('decentra.matrix.session.v1')
  })
})

When('I set my presence to {string}', async function (presenceValue) {
  const presenceSelect = this.page.locator('label')
    .filter({ hasText: /Presence|Status/i })
    .locator('select')
    .first()
  await expect(presenceSelect).toBeVisible({ timeout: 10000 })
  await presenceSelect.selectOption(normalizePresenceValue(presenceValue))

  const applyPresenceButton = this.page.getByRole('button', {
    name: /Apply presence|Status setzen/i
  })
  await applyPresenceButton.click()
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
  const messageItem = messageContainerByBody(this.page, messageText)
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await messageItem.hover()
  const replyButton = messageItem
    .getByRole('button', { name: /Reply|Antworten/i })
    .first()
  await expect(replyButton).toBeVisible({ timeout: 10000 })
  await replyButton.click()
})

When(
  'I add reaction {string} on message body {string}',
  async function (emoji, messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    await messageItem.hover()

    const reactionButton = messageItem.getByRole('button', {
      name: /Add reaction/i
    }).first()
    await expect(reactionButton).toBeVisible({ timeout: 10000 })
    await reactionButton.click()

    const emojiOption = this.page
      .locator(`[data-emoji-option="${emoji}"]`)
      .first()
    await expect(emojiOption).toBeVisible({ timeout: 10000 })
    await emojiOption.click()
  }
)

When(
  'I remove reaction {string} on message body {string}',
  async function (emoji, messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    const reactionChip = messageItem
      .locator(`[data-reaction-chip="${emoji}"]`)
      .first()
    await expect(reactionChip).toBeVisible({ timeout: 10000 })
    await reactionChip.click()
  }
)

Then(
  'I should see reaction {string} with count {string} on message body {string}',
  async function (emoji, count, messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    const reactionChip = messageItem
      .locator(`[data-reaction-chip="${emoji}"]`)
      .first()
    await expect(reactionChip).toBeVisible({ timeout: 10000 })
    await expect(reactionChip).toContainText(emoji)
    await expect(reactionChip).toContainText(count)
  }
)

Then(
  'I should not see reaction {string} on message body {string}',
  async function (emoji, messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    const reactionChip = messageItem
      .locator(`[data-reaction-chip="${emoji}"]`)
      .first()
    await expect(reactionChip).toHaveCount(0)
  }
)

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

Then(
  'I should see my member status indicator as {string}',
  async function (presenceValue) {
    const expectedClassName = expectedPresenceDotClass(presenceValue)
    const currentUserNeedle = currentUserNameNeedle()
    const memberRow = this.page.locator('li')
      .filter({ hasText: new RegExp(currentUserNeedle, 'i') })
      .first()
    await expect(memberRow).toBeVisible({ timeout: 15000 })

    const statusDot = memberRow.locator('span.absolute.h-3.w-3.rounded-full')
      .first()
    await expect(statusDot).toHaveClass(new RegExp(expectedClassName), {
      timeout: 15000
    })
  }
)
