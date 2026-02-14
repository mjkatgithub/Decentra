<script setup lang="ts">
import { ClientEvent, RoomEvent } from 'matrix-js-sdk'
import type { Room } from 'matrix-js-sdk'

const { client, isLoggedIn, userId, getRooms, logout, loadOlderMessages } =
  useMatrixClient()
const selectedRoomId = ref<string | null>(null)
const messages = ref<{ id: string; sender: string; body: string }[]>([])
const rooms = ref<Room[]>([])
const loadingOlder = ref(false)
const canLoadOlder = ref(true)

if (!isLoggedIn.value) {
  navigateTo('/login')
}

function refreshRooms() {
  rooms.value = getRooms()
}

function selectRoom(roomId: string) {
  selectedRoomId.value = roomId
  canLoadOlder.value = true
  loadMessages(roomId)
}

async function onLoadOlder() {
  if (!selectedRoomId.value || loadingOlder.value) return
  loadingOlder.value = true
  try {
    const hasMore = await loadOlderMessages(selectedRoomId.value)
    canLoadOlder.value = hasMore
    loadMessages(selectedRoomId.value)
  } finally {
    loadingOlder.value = false
  }
}

function handleLogout() {
  logout()
  navigateTo('/login')
}

function loadMessages(roomId: string) {
  const room = client.value?.getRoom(roomId)
  if (!room) {
    messages.value = []
    return
  }
  messages.value = room
    .getLiveTimeline()
    .getEvents()
    .filter((event) => event.getType() === 'm.room.message')
    .map((event) => ({
      id: event.getId() ?? '',
      sender: event.getSender() ?? '',
      body: event.getContent().body ?? ''
    }))
}

watch(
  () => client.value,
  (matrixClient) => {
    if (!matrixClient) return
    refreshRooms()
    matrixClient.once(ClientEvent.Sync, (state) => {
      if (state === 'PREPARED') refreshRooms()
    })
    matrixClient.on(RoomEvent.Timeline, (_event, room) => {
      if (room?.roomId === selectedRoomId.value) {
        loadMessages(room.roomId)
      }
    })
    matrixClient.on(RoomEvent.MyMembership, () => refreshRooms())
  },
  { immediate: true }
)

watch(selectedRoomId, (roomId) => {
  if (roomId) loadMessages(roomId)
})
</script>

<template>
  <div class="flex h-screen">
    <aside class="flex w-64 shrink-0 flex-col">
      <div
        v-if="userId"
        class="flex flex-col gap-2 border-b border-gray-200 px-3 py-2
               dark:border-gray-700"
      >
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Eingeloggt als
          <span
            class="block truncate font-medium text-gray-700 dark:text-gray-300"
          >
            {{ userId }}
          </span>
        </div>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          block
          @click="handleLogout"
        >
          Abmelden
        </UButton>
      </div>
      <ChatRoomList
        :rooms="rooms.map((room) => ({ roomId: room.roomId, name: room.name }))"
        :selected-room-id="selectedRoomId"
        @select="selectRoom"
      />
    </aside>
    <main class="flex flex-1 flex-col">
      <div
        v-if="!selectedRoomId"
        class="flex flex-1 items-center justify-center text-gray-500"
      >
        Wähle einen Raum
      </div>
      <template v-else>
        <ChatMessageList
          :messages="messages"
          :can-load-older="canLoadOlder"
          :loading-older="loadingOlder"
          @load-older="onLoadOlder"
        />
        <ChatMessageInput
          :room-id="selectedRoomId"
          :disabled="!client"
        />
      </template>
    </main>
  </div>
</template>
