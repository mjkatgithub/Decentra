<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

interface RoomItem {
  roomId: string
  name: string
}

interface RoomSectionItem {
  id: string
  name: string
  rooms: RoomItem[]
}

defineProps<{
  selectedSpaceName: string
  categories: RoomSectionItem[]
  selectedRoomId: string | null
}>()

const emit = defineEmits<{
  selectRoom: [roomId: string]
  openSpaceSettings: []
}>()

const { translateText } = useAppI18n()

function selectRoom(roomId: string) {
  emit('selectRoom', roomId)
}
</script>

<template>
  <section
    class="flex h-full w-72 flex-col border-r border-gray-200 bg-white
           dark:border-gray-800 dark:bg-gray-900"
  >
    <header
      class="flex items-center justify-between border-b border-gray-200 px-3 py-2
             dark:border-gray-800"
    >
      <div class="min-w-0">
        <p
          class="text-xs font-semibold uppercase tracking-wide text-gray-500
                 dark:text-gray-400"
        >
          {{ translateText('layout.channels') }}
        </p>
        <p class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
          {{ selectedSpaceName }}
        </p>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings-2"
        :aria-label="translateText('layout.openSpaceSettings')"
        @click="emit('openSpaceSettings')"
      />
    </header>

    <div class="flex-1 overflow-y-auto px-2 py-3">
      <template v-if="categories.length === 0">
        <p class="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('layout.noRoomsInSpace') }}
        </p>
      </template>
      <template v-else>
        <div
          v-for="category in categories"
          :key="category.id"
          class="mb-4"
        >
          <p
            class="px-2 pb-1 text-xs font-semibold uppercase tracking-wide
                   text-gray-500 dark:text-gray-400"
          >
            {{ category.name }}
          </p>
          <div class="space-y-1">
            <button
              v-for="room in category.rooms"
              :key="room.roomId"
              type="button"
              class="w-full rounded-lg px-2 py-2 text-left text-sm transition"
              :class="selectedRoomId === room.roomId
                ? 'bg-primary-500/15 text-primary-500'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'"
              @click="selectRoom(room.roomId)"
            >
              <span class="truncate"># {{ room.name }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
