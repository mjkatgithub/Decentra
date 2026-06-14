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
    throw new Error('Secondary Matrix login failed for typing E2E step')
  }
  return { accessToken: body.access_token, userId: body.user_id }
}

async function setSecondaryTyping(isTyping) {
  const homeserver = matrixHomeserverUrl()
  const roomId = requireEnv('E2E_TEST_ROOM_ID')
  const { accessToken, userId } = await fetchSecondaryAccessToken()
  const encodedRoomId = encodeURIComponent(roomId)
  const encodedUserId = encodeURIComponent(userId)
  const body = isTyping
    ? JSON.stringify({ typing: true, timeout: 30_000 })
    : JSON.stringify({ typing: false })
  const response = await fetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}`
      + `/typing/${encodedUserId}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body,
    },
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Secondary typing update failed (${response.status}): ${errorText}`,
    )
  }
}

When(
  'the secondary user starts typing in the main test room',
  async function () {
    await setSecondaryTyping(true)
    await new Promise((resolve) => {
      setTimeout(resolve, 1500)
    })
  },
)

When(
  'the secondary user stops typing in the main test room',
  async function () {
    await setSecondaryTyping(false)
  },
)

Then('the typing indicator should be visible', async function () {
  const indicator = this.page.getByTestId('typing-indicator')
  await expect(indicator).toBeVisible({ timeout: 30_000 })
  await expect(indicator).toHaveText(/typing|schreibt/i)
})

Then('the typing indicator should not be visible', async function () {
  const indicator = this.page.getByTestId('typing-indicator')
  await expect(indicator).toHaveCount(0, { timeout: 15_000 })
})
