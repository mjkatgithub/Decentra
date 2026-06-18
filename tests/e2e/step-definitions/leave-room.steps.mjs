import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

function requireEnv(variableName) {
  const variableValue = process.env[variableName]
  if (!variableValue) {
    throw new Error(`Missing required E2E env: ${variableName}`)
  }
  return variableValue
}

function leaveGroupRoomId() {
  return requireEnv('E2E_LEAVE_GROUP_ROOM_ID')
}

function seededSpaceChannelId() {
  return requireEnv('E2E_TEST_SPACE_CHANNEL_ID')
}

function leaveDmRoomId() {
  return requireEnv('E2E_LEAVE_DM_ROOM_ID')
}

function homeSidebar(page) {
  return page.locator('.decentra-shell > aside').first()
}

function homeSidebarRoomButton(page, roomId) {
  return homeSidebar(page)
    .locator(`button[data-room-id="${roomId}"]`)
    .first()
}

function homeSidebarRoomActionsButton(page, roomId) {
  return homeSidebar(page)
    .locator(`button[data-room-actions="${roomId}"]`)
    .first()
}

async function waitForHomeSidebarReady(page) {
  const sidebarRooms = homeSidebar(page).locator('button[data-room-id]')
  await expect(sidebarRooms.first()).toBeVisible({ timeout: 60000 })
}

async function openHomeSidebarRoom(page, roomId, nameFallbackPattern) {
  await waitForHomeSidebarReady(page)
  let roomButton = homeSidebarRoomButton(page, roomId)
  if ((await roomButton.count()) === 0 && nameFallbackPattern) {
    roomButton = homeSidebar(page)
      .getByRole('button', { name: nameFallbackPattern })
      .first()
  }
  await expect(roomButton).toBeVisible({ timeout: 60000 })
  await roomButton.scrollIntoViewIfNeeded()
  await roomButton.click({ force: true })
}

async function openChannelOptionsMenu(page, roomId) {
  const roomButton = homeSidebarRoomButton(page, roomId)
  await expect(roomButton).toBeVisible({ timeout: 20000 })
  await roomButton.hover()
  const actionsButton = homeSidebarRoomActionsButton(page, roomId)
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

async function assertRoomAbsentFromHomeSidebar(page, roomId) {
  await expect(homeSidebarRoomButton(page, roomId)).toHaveCount(0, {
    timeout: 20000,
  })
}

When('I open the leave test group room', async function () {
  const roomId = leaveGroupRoomId()
  const roomName =
    process.env.E2E_LEAVE_GROUP_ROOM_NAME || 'Decentra E2E Leave Group Room'
  await openHomeSidebarRoom(
    this.page,
    roomId,
    new RegExp(roomName, 'i'),
  )
})

When('I select Home in the space rail', async function () {
  const homeButton = this.page
    .locator('button[data-space-id="__home__"]')
    .first()
  await expect(homeButton).toBeVisible({ timeout: 60000 })
  await homeButton.click()
  await waitForHomeSidebarReady(this.page)
})

When('I select the seeded test space in the space rail', async function () {
  const spaceId = requireEnv('E2E_TEST_SPACE_ID')
  const spaceButton = this.page
    .locator(`button[data-space-id="${spaceId}"]`)
    .first()
  await expect(spaceButton).toBeVisible({ timeout: 60000 })
  await spaceButton.click()
})

async function openSpaceChannelFromPanel(page, channelId) {
  const roomButton = page
    .locator('[data-space-home-panel]')
    .locator(`[data-space-home-room-id="${channelId}"]`)
    .first()
  await expect(roomButton).toBeVisible({ timeout: 45000 })
  await roomButton.click()
  await expect(page.locator('[data-space-home-panel]')).toHaveCount(0, {
    timeout: 30000,
  })
}

When('I open the seeded test space channel', async function () {
  await openSpaceChannelFromPanel(this.page, seededSpaceChannelId())
})

function spaceHomeChannelId() {
  return requireEnv('E2E_SPACE_HOME_CHANNEL_ID')
}

When('I open the seeded space home channel', async function () {
  await openSpaceChannelFromPanel(this.page, spaceHomeChannelId())
})

When('I open the leave test dm room', async function () {
  const roomId = leaveDmRoomId()
  const peerName = requireEnv('E2E_SECOND_MATRIX_USERNAME')
    .split(':')[0]
    .replace('@', '')
  await openHomeSidebarRoom(
    this.page,
    roomId,
    new RegExp(peerName, 'i'),
  )
})

When(
  'I open the channel options menu for the leave test group room',
  async function () {
    await openChannelOptionsMenu(this.page, leaveGroupRoomId())
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
  'the leave test group room should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromHomeSidebar(this.page, leaveGroupRoomId())
  },
)

Then(
  'the seeded test space channel should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromHomeSidebar(
      this.page,
      seededSpaceChannelId(),
    )
  },
)

Then(
  'the leave test dm room should not appear in the sidebar',
  async function () {
    await assertRoomAbsentFromHomeSidebar(this.page, leaveDmRoomId())
  },
)

Then('I should not be able to send messages in chat', async function () {
  await expect(this.page.getByTestId('composer-send-button'))
    .not.toBeVisible({ timeout: 10000 })
})
