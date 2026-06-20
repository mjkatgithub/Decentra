<script setup lang="ts">
interface RoomItem {
  roomId: string
  name?: string
}

defineProps<{
  rooms: RoomItem[]
  selectedRoomId: string | null
}>()

const emit = defineEmits<{
  select: [roomId: string]
}>()

function selectRoom(roomId: string) {
  emit('select', roomId)
}
</script>

<template>
  <div
    class="flex flex-1 flex-col overflow-hidden border-r border-gray-200
           dark:border-gray-700"
  >
    <div class="border-b border-gray-200 p-3 dark:border-gray-700">
      <h2 class="font-semibold">Channels</h2>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <template v-if="rooms.length === 0">
        <p class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No rooms
        </p>
      </template>
      <template v-else>
        <button
          v-for="room in rooms"
          :key="room.roomId"
          type="button"
          class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="{
            'bg-primary-500/10 text-primary-600 dark:text-primary-400':
              selectedRoomId === room.roomId
          }"
          @click="selectRoom(room.roomId)"
        >
          {{ room.name || room.roomId }}
        </button>
      </template>
    </div>
  </div>
</template>
