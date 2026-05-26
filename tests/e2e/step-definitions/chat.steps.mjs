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

async function revealMessageActions(messageItem, options = {}) {
  const preferTap = options.preferTap === true
  if (preferTap) {
    await messageItem.tap()
    return
  }
  await messageItem.hover()
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

When('I send {string} from the message composer', async function (text) {
  const input = this.page.getByPlaceholder(
    /Write a message|Nachricht eingeben/i
  ).last()
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill(text)
  await input.press('Enter')
})

function composerInput(page) {
  return page.getByPlaceholder(/Write a message|Nachricht eingeben/i).last()
}

When('I open the composer emoji picker', async function () {
  const emojiButton = this.page.getByTestId('composer-emoji-button').last()
  await expect(emojiButton).toBeVisible({ timeout: 15000 })
  await emojiButton.click()
  const picker = this.page.getByTestId('composer-emoji-picker').last()
  await expect(picker).toBeVisible({ timeout: 10000 })
})

When(
  'I select emoji {string} from the composer picker',
  async function (emoji) {
    const picker = this.page.getByTestId('composer-emoji-picker').last()
    const emojiOption = picker.locator(`[data-emoji-option="${emoji}"]`).first()
    await expect(emojiOption).toBeVisible({ timeout: 10000 })
    await emojiOption.click()
  }
)

When('I send the composer draft', async function () {
  const input = composerInput(this.page)
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.press('Enter')
})

When('I type {string} in the message composer', async function (text) {
  const input = composerInput(this.page)
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill(text)
})

function pinnedMessagesPanel(page) {
  return page.locator('aside').filter({
    has: page.getByText(/Pinned messages|Angepinnte Nachrichten/i)
  }).first()
}

When('I click pin on message body {string}', async function (messageText) {
  const messageItem = messageContainerByBody(this.page, messageText)
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await revealMessageActions(messageItem)
  const pinButton = messageItem
    .getByRole('button', { name: /^(Pin|Anheften)$/i })
    .first()
  await expect(pinButton).toBeVisible({ timeout: 10000 })
  await pinButton.click()
})

When('I click unpin on message body {string}', async function (messageText) {
  const messageItem = messageContainerByBody(this.page, messageText)
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await revealMessageActions(messageItem)
  const unpinButton = messageItem
    .getByRole('button', { name: /^(Unpin|Lösen)$/i })
    .first()
  await expect(unpinButton).toBeVisible({ timeout: 10000 })
  await unpinButton.click()
})

When('I open the pinned messages panel', async function () {
  const openButton = this.page.getByRole('button', {
    name: /Open pinned messages|Angepinnte Nachrichten öffnen/i
  }).first()
  await expect(openButton).toBeVisible({ timeout: 15000 })
  await openButton.click()
  await expect(pinnedMessagesPanel(this.page)).toBeVisible({
    timeout: 10000
  })
})

Then(
  'I should see {string} in the pinned messages panel',
  async function (messageText) {
    const panel = pinnedMessagesPanel(this.page)
    await expect(panel).toBeVisible({ timeout: 15000 })
    await expect(panel.getByText(messageText, { exact: false }).first())
      .toBeVisible({ timeout: 15000 })
  }
)

Then(
  'I should not see {string} in the pinned messages panel',
  async function (messageText) {
    const panel = pinnedMessagesPanel(this.page)
    await expect(panel).toBeVisible({ timeout: 15000 })
    await expect(panel.getByText(messageText, { exact: false }))
      .toHaveCount(0, { timeout: 15000 })
  }
)

When('I open pinned message {string}', async function (messageText) {
  const panel = pinnedMessagesPanel(this.page)
  const entry = panel.getByRole('button').filter({
    hasText: messageText
  }).first()
  await expect(entry).toBeVisible({ timeout: 15000 })
  await entry.click()
})

When('I click edit on message body {string}', async function (messageText) {
  const messageItem = messageContainerByBody(this.page, messageText)
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await revealMessageActions(messageItem)
  const editButton = messageItem
    .getByRole('button', { name: /Edit|Bearbeiten/i })
    .first()
  await expect(editButton).toBeVisible({ timeout: 10000 })
  await editButton.click()
})

When('I submit the edit composer with {string}', async function (text) {
  const input = this.page.getByPlaceholder(
    /Write a message|Nachricht eingeben/i
  ).last()
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.fill(text)
  await input.press('Enter')
})

Then('I should see the edit composer active', async function () {
  await expect(
    this.page.getByRole('button', {
      name: /Cancel edit|Bearbeitung abbrechen/i
    })
  ).toBeVisible({ timeout: 10000 })
})

Then(
  'I should see the edited label on message body {string}',
  async function (messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    await expect(messageItem.getByText(/\(edited\)|\(bearbeitet\)/i))
      .toBeVisible({ timeout: 10000 })
  }
)

When('I click reply on message body {string}', async function (messageText) {
  const messageItem = messageContainerByBody(this.page, messageText)
  await expect(messageItem).toBeVisible({ timeout: 15000 })
  await revealMessageActions(messageItem)
  const replyButton = messageItem
    .getByRole('button', { name: /Reply|Antworten/i })
    .first()
  await expect(replyButton).toBeVisible({ timeout: 10000 })
  await replyButton.click()
})

When('I use the mobile chat viewport', async function () {
  await this.page.setViewportSize({ width: 390, height: 844 })
  await this.page.emulateMedia({ media: 'screen' })
})

When(
  'I tap reply on message body {string} on mobile',
  async function (messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    await revealMessageActions(messageItem, { preferTap: true })
    const replyButton = messageItem
      .getByRole('button', { name: /Reply|Antworten/i })
      .first()
    await expect(replyButton).toBeVisible({ timeout: 10000 })
    await replyButton.tap()
  }
)

When(
  'I add reaction {string} on message body {string}',
  async function (emoji, messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    await revealMessageActions(messageItem)

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
  'the reply to {string} should show an image thumbnail',
  async function (replyBodyText) {
    const replyContainer = this.page.locator('div.group').filter({
      hasText: replyBodyText,
    }).first()
    const thumbnail = replyContainer.locator('.reply-preview img')
    await expect(thumbnail).toBeVisible({ timeout: 15000 })
  },
)

When(
  'I click the reply quote on message body {string}',
  async function (replyBodyText) {
    const replyContainer = this.page.locator('div.group').filter({
      hasText: replyBodyText,
    }).first()
    const quote = replyContainer.locator('.reply-preview[role="button"]')
    await expect(quote).toBeVisible({ timeout: 10000 })
    await quote.click()
  },
)

Then(
  'message body {string} should be visible in the timeline',
  async function (messageBodyText) {
    const messageRow = messageContainerByBody(this.page, messageBodyText)
    await expect(messageRow).toBeVisible({ timeout: 15000 })
    await expect(messageRow).toBeInViewport({ timeout: 10000 })
  },
)

When(
  'I open the thread on message body {string}',
  async function (messageText) {
    const messageItem = messageContainerByBody(this.page, messageText)
    await expect(messageItem).toBeVisible({ timeout: 15000 })
    await revealMessageActions(messageItem)
    const threadButton = messageItem.getByRole('button', {
      name: /Thread/i
    }).first()
    await expect(threadButton).toBeVisible({ timeout: 10000 })
    await threadButton.click()
  }
)

Then('I should see the thread side panel', async function () {
  await expect(
    this.page.getByRole('button', {
      name: /Close thread panel|Thread schließen/i
    }).first()
  ).toBeVisible({ timeout: 15000 })
})

When(
  'I send {string} from the thread composer',
  async function (text) {
    const input = this.page.getByPlaceholder(
      /Write a message|Nachricht eingeben/i
    )
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill(text)
    await input.press('Enter')
  }
)

When('I close the thread side panel', async function () {
  await this.page.getByRole('button', {
    name: /Close thread panel|Thread schließen/i
  }).first().click()
})

Then('I should not see the thread side panel', async function () {
  await expect(
    this.page.getByRole('button', {
      name: /Close thread panel|Thread schließen/i
    })
  ).toHaveCount(0)
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

When('voice recording APIs are mocked in the browser', async function () {
  await this.page.addInitScript(() => {
    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream
        this.mimeType = options?.mimeType || 'audio/webm'
        this.state = 'inactive'
        this.ondataavailable = null
        this.onstop = null
        this.onerror = null
      }

      start() {
        this.state = 'recording'
        setTimeout(() => {
          if (typeof this.ondataavailable === 'function') {
            this.ondataavailable({
              data: new Blob(['mock-audio-data'], { type: this.mimeType })
            })
          }
        }, 0)
      }

      stop() {
        this.state = 'inactive'
        if (typeof this.onstop === 'function') {
          this.onstop()
        }
      }

      pause() {
        this.state = 'paused'
      }

      resume() {
        this.state = 'recording'
      }

      static isTypeSupported() {
        return true
      }
    }

    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [{ stop: () => undefined }]
    })
    window.MediaRecorder = MockMediaRecorder
  })
})

When('voice recording permission is denied in the browser', async function () {
  await this.page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    }
  })
})

Then(
  'I should see voice message player for {string}',
  async function (voiceLabel) {
    const voicePlayer = this.page
      .locator('[data-testid="voice-message-player"]')
      .filter({ hasText: voiceLabel })
      .first()
    await expect(voicePlayer).toBeVisible({ timeout: 20000 })
  }
)

When('I start voice recording from the composer', async function () {
  const voiceButton = this.page.getByTestId('composer-voice-button').last()
  await expect(voiceButton).toBeVisible({ timeout: 15000 })
  await voiceButton.click()
})

When('I record preview and send a voice message', async function () {
  await this.page.getByTestId('composer-voice-button').last().click()
  const recordingBar = this.page.getByTestId('voice-recording-bar').last()
  await expect(recordingBar).toBeVisible({ timeout: 10000 })
  await this.page.getByTestId('voice-stop-button').last().click()
  const previewBar = this.page.getByTestId('voice-preview-bar').last()
  await expect(previewBar).toBeVisible({ timeout: 10000 })
  await this.page.getByTestId('voice-send-button').last().click()
})

Then('I should see voice recording permission denied feedback', async function () {
  await expect(this.page.getByTestId('voice-recorder-error').last())
    .toBeVisible({ timeout: 15000 })
  await expect(this.page.getByTestId('voice-recorder-error').last())
    .toContainText(/Microphone access was denied|Mikrofonzugriff verweigert/i)
})
