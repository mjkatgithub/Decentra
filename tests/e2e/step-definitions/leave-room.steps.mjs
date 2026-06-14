import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

function requireEnv(variableName) {
  const variableValue = process.env[variableName]
  if (!variableValue) {
    throw new Error(`Missing required E2E env: ${variableName}`)
  }
  return variableValue
}

function sideTestRoomId() {
  return requireEnv('E2E_SIDE_TEST_ROOM_ID')
}

function seededSpaceChannelId() {
  return requireEnv('E2E_TEST_SPACE_CHANNEL_ID')
}

function leaveDmRoomId() {
  return requireEnv('E2E_LEAVE_DM_ROOM_ID')
}

function roomButtonById(page, roomId) {
  return page.locator(`button[data-room-id="${roomId}"]`).first()
}

async function openChannelOptionsMenu(page, roomId) {
  const roomButton = roomButtonById(page, roomId)
  await expect(roomButton).toBeVisible({ timeout: 20000 })
  await roomButton.hover()
  const actionsButton = page
    .locator(`button[data-room-actions="${roomId}"]`)
    .first()
  await expect(actionsButton).toBeVisible({ timeout: 10000 })
  await actionsButton.click()
}

async function chooseLeaveChannelFromMenu(page) {
  const leavePattern = /Leave channel|Kanal verlassen/i
  const menuItem = page.getByRole('menuitem', { name: leavePattern })
  if (await menuItem.count() > 0) {
    await menuItem.first().click()
    return
  }
  const menuButton = page.getByRole('button', { name: leavePattern })
  if (await menuButton.count() > 0) {
    await menuButton.first().click()
    return
  }
  await page.getByText(leavePattern).first().click()
}

async function confirmLeaveChannel(page) {
  await expect(
    page.getByRole('heading', {
      name: /Leave channel\?|Kanal verlassen\?/i,
    }),
  ).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: /^(Leave|Verlassen)$/i }).click()
}

async function assertChatHomeOnboarding(page) {
  const onboardingHeading = page.getByRole('heading', {
    name: /Get started|Erste Schritte/i,
  })
  const startDmButton = page.getByRole('button', {
    name: /Start direct message|Direktnachricht starten/i,
  })
  await expect(onboardingHeading.or(startDmButton)).toBeVisible({
    timeout: 20000,
  })
}

async function assertSpaceHomePanel(page) {
  await expect(page.locator('[data-space-home-panel]')).toBeVisible({
    timeout: 20000,
  })
}

async function assertRoomAbsentFromSidebar(page, roomId) {
  await expect(roomButtonById(page, roomId)).toHaveCount(0, {
    timeout: 20000,
  })
}

When('I open the side seeded test room for leave', async function () {
  const roomId = requireEnv('E2E_SIDE_TEST_ROOM_ID')
  const roomName =
    process.env.E2E_SIDE_TEST_ROOM_NAME || 'Decentra E2E Side Room'
  const roomButton = roomButtonById(this.page, roomId)
    .or(this.page.getByRole('button', { name: new RegExp(roomName, 'i') }))
    .first()
  await expect(roomButton).toBeVisible({ timeout: 60000 })
  await roomButton.click()
})

When('I select Home in the space rail', async function () {
  const homeButton = this.page
    .locator('button[data-space-id="__home__"]')
    .first()
  await expect(homeButton).toBeVisible({ timeout: 20000 })
  await homeButton.click()
})

When('I select the seeded test space in the space rail', async function () {
  const spaceId = requireEnv('E2E_TEST_SPACE_ID')
  const spaceButton = this.page
    .locator(`button[data-space-id="${spaceId}"]`)
    .first()
  await expect(spaceButton).toBeVisible({ timeout: 20000 })
  await spaceButton.click()
})

When('I open the seeded test space channel', async function () {
  const channelId = requireEnv('E2E_TEST_SPACE_CHANNEL_ID')
  const channelName =
    process.env.E2E_TEST_SPACE_CHANNEL_NAME || 'E2E Space General'
  const roomById = this.page
    .locator(`[data-space-home-room-id="${channelId}"]`)
    .first()
  const roomByName = this.page
    .getByRole('button', { name: new RegExp(channelName, 'i') })
    .first()
  const roomButton = roomById.or(roomByName).first()
  await expect(roomButton).toBeVisible({ timeout: 45000 })
  await roomButton.click()
  await expect(this.page.locator('[data-space-home-panel]')).toHaveCount(0, {
    timeout: 30000,
  })
})

When('I open the leave test dm room', async function () {
  const roomId = leaveDmRoomId()
  const peerName = requireEnv('E2E_SECOND_MATRIX_USERNAME')
    .split(':')[0]
    .replace('@', '')
  const roomButton = roomButtonById(this.page, roomId)
    .or(this.page.getByRole('button', { name: new RegExp(peerName, 'i') }))
    .first()
  await expect(roomButton).toBeVisible({ timeout: 60000 })
  await roomButton.click()
})

When(
  'I open the channel options menu for the side seeded test room',
  async function () {
    await openChannelOptionsMenu(this.page, sideTestRoomId())
  },
)

When(
  'I open the channel options menu for the seeded test space channel',
  async function () {
    await openChannelOptionsMenu(this.page, seededSpaceChannelId())
  },
)

When(
  'I open the channel options menu for the leave test dm room',
  async function () {
    await openChannelOptionsMenu(this.page, leaveDmRoomId())
  },
)

When('I choose leave channel from the menu', async function () {
  await chooseLeaveChannelFromMenu(this.page)
})

When('I confirm leaving the channel', async function () {
  await confirmLeaveChannel(this.page)
})

Then('I should see the chat home onboarding panel', async function () {
  await assertChatHomeOnboarding(this.page)
})

Then('I should see the space home panel', async function () {
  await assertSpaceHomePanel(this.page)
})

Then('I should not see the space home panel', async function () {
  await expect(this.page.locator('[data-space-home-panel]'))
    .toHaveCount(0, { timeout: 20000 })
})

Then(
  'the side seeded test room should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromSidebar(this.page, sideTestRoomId())
  },
)

Then(
  'the seeded test space channel should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromSidebar(this.page, seededSpaceChannelId())
  },
)

Then(
  'the leave test dm room should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromSidebar(this.page, leaveDmRoomId())
  },
)

Then('I should not be able to send messages in chat', async function () {
  await expect(this.page.getByTestId('composer-send-button'))
    .not.toBeVisible({ timeout: 10000 })
})
