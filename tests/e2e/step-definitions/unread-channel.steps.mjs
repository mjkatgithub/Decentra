import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

function requireEnv(variableName) {
  const variableValue = process.env[variableName]
  if (!variableValue) {
    throw new Error(`Missing required E2E env: ${variableName}`)
  }
  return variableValue
}

function matrixHomeserverUrl() {
  return requireEnv('E2E_MATRIX_HOMESERVER').replace(/\/$/, '')
}

import { resolveE2EMatrixUserId } from '../support/e2e-credentials.mjs'

function primaryMatrixUserId() {
  return resolveE2EMatrixUserId()
}

function primaryLocalpart() {
  const userId = primaryMatrixUserId()
  return userId.startsWith('@')
    ? userId.slice(1).split(':')[0]
    : userId
}

async function fetchSecondaryAccessToken() {
  const homeserver = matrixHomeserverUrl()
  const userId = requireEnv('E2E_SECOND_MATRIX_USERNAME')
  const password = requireEnv('E2E_SECOND_MATRIX_PASSWORD')
  const localpart = userId.startsWith('@')
    ? userId.slice(1).split(':')[0]
    : userId

  const response = await fetch(`${homeserver}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password,
    }),
  })
  const bodyText = await response.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!response.ok || !body.access_token) {
    throw new Error('Secondary Matrix login failed for unread E2E step')
  }
  return body.access_token
}

async function sendRoomMessageAsSecondary(roomId, content) {
  const homeserver = matrixHomeserverUrl()
  const accessToken = await fetchSecondaryAccessToken()
  const transactionId = `e2e-unread-${Date.now()}`
  const response = await fetch(
    `${homeserver}/_matrix/client/v3/rooms/`
      + `${encodeURIComponent(roomId)}/send/m.room.message/`
      + transactionId,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(content),
    },
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Secondary send failed (${response.status}): ${errorText}`,
    )
  }
}

async function sendMessageAsSecondary(roomId, messageBody) {
  await sendRoomMessageAsSecondary(roomId, {
    msgtype: 'm.text',
    body: messageBody,
  })
}

async function sendMentionAsSecondary(roomId, messageBody) {
  const targetUserId = primaryMatrixUserId()
  const localpart = primaryLocalpart()
  await sendRoomMessageAsSecondary(roomId, {
    msgtype: 'm.text',
    body: `${messageBody} @${localpart}`,
    'm.mentions': {
      user_ids: [targetUserId],
    },
  })
}

function mainTestRoomButton(page) {
  const roomId = requireEnv('E2E_TEST_ROOM_ID')
  return page.locator(`button[data-room-id="${roomId}"]`).first()
}

function mainTestSpaceButton(page) {
  const spaceId = requireEnv('E2E_TEST_SPACE_ID')
  return page.locator(`button[data-space-id="${spaceId}"]`).first()
}

When('I open the side seeded test room', async function () {
  const sideRoomName =
    process.env.E2E_SIDE_TEST_ROOM_NAME || 'Decentra E2E Side Room'
  const roomButton = this.page
    .getByRole('button', { name: new RegExp(sideRoomName, 'i') })
    .first()
  await expect(roomButton).toBeVisible({ timeout: 20000 })
  await roomButton.click()
})

When(
  'the secondary user sends {string} to the main test room',
  async function (messageBody) {
    const roomId = requireEnv('E2E_TEST_ROOM_ID')
    await sendMessageAsSecondary(roomId, messageBody)
  },
)

When(
  'the secondary user mentions the primary user with {string} in the main test room',
  async function (messageBody) {
    const roomId = requireEnv('E2E_TEST_ROOM_ID')
    await sendMentionAsSecondary(roomId, messageBody)
  },
)

When(
  'the secondary user mentions the primary user with {string} in the seeded space channel',
  async function (messageBody) {
    const roomId = requireEnv('E2E_TEST_SPACE_CHANNEL_ID')
    await sendMentionAsSecondary(roomId, messageBody)
  },
)

Then('the main test room should show an unread indicator', async function () {
  const roomButton = mainTestRoomButton(this.page)
  await expect(roomButton).toBeVisible({ timeout: 20000 })
  await expect(roomButton).toHaveAttribute('data-unread', 'true', {
    timeout: 20000,
  })
})

Then(
  'the main test room should not show a mention unread indicator',
  async function () {
    const roomButton = mainTestRoomButton(this.page)
    await expect(roomButton).toBeVisible({ timeout: 20000 })
    await expect(roomButton).toHaveAttribute('data-mention-unread', 'false', {
      timeout: 20000,
    })
  },
)

Then(
  'the main test room should show a mention unread indicator',
  async function () {
    const roomButton = mainTestRoomButton(this.page)
    await expect(roomButton).toBeVisible({ timeout: 20000 })
    await expect(roomButton).toHaveAttribute('data-mention-unread', 'true', {
      timeout: 20000,
    })
  },
)

Then(
  'the main test room should not show an unread indicator',
  async function () {
    const roomButton = mainTestRoomButton(this.page)
    await expect(roomButton).toBeVisible({ timeout: 20000 })
    await expect(roomButton).toHaveAttribute('data-unread', 'false', {
      timeout: 20000,
    })
    await expect(roomButton).toHaveAttribute('data-mention-unread', 'false', {
      timeout: 20000,
    })
  },
)

Then(
  'the seeded test space should show a mention unread indicator on the space rail',
  async function () {
    const spaceButton = mainTestSpaceButton(this.page)
    await expect(spaceButton).toBeVisible({ timeout: 20000 })
    await expect(spaceButton).toHaveAttribute('data-mention-unread', 'true', {
      timeout: 20000,
    })
  },
)
