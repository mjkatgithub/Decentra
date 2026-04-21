<script setup lang="ts">
import type { PublicRoomListItem } from '~/composables/useMatrixClient'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

const { translateText } = useAppI18n()
const { searchPublicRooms, joinRoomByIdOrAlias } = useMatrixClient()

const emit = defineEmits<{
  back: []
  joined: [roomId: string]
}>()

const searchTerm = ref('')
const rooms = ref<PublicRoomListItem[]>([])
const nextBatch = ref<string | undefined>(undefined)
const loading = ref(false)
const joiningId = ref<string | null>(null)
const errorMessage = ref('')
const emptyReason = ref<'none' | 'noResults' | null>(null)

async function load(reset: boolean) {
  errorMessage.value = ''
  emptyReason.value = null
  loading.value = true
  try {
    const result = await searchPublicRooms({
      searchTerm: searchTerm.value.trim() || undefined,
      limit: 30,
      since: reset ? undefined : nextBatch.value
    })
    if (reset) {
      rooms.value = result.rooms
    } else {
      rooms.value = [...rooms.value, ...result.rooms]
    }
    nextBatch.value = result.nextBatch
    if (result.rooms.length === 0) {
      emptyReason.value = searchTerm.value.trim()
        ? 'noResults'
        : 'none'
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  nextBatch.value = undefined
  await load(true)
}

async function handleLoadMore() {
  if (!nextBatch.value || loading.value) {
    return
  }
  await load(false)
}

async function handleJoin(room: PublicRoomListItem) {
  const target = room.canonicalAlias || room.roomId
  joiningId.value = room.roomId
  errorMessage.value = ''
  try {
    const roomId = await joinRoomByIdOrAlias(target)
    emit('joined', roomId)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    joiningId.value = null
  }
}

onMounted(() => {
  void handleSearch()
})
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex items-start justify-between gap-2">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
        {{ translateText('onboarding.publicTitle') }}
      </h2>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        @click="emit('back')"
      >
        {{ translateText('onboarding.back') }}
      </UButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <UInput
        v-model="searchTerm"
        class="min-w-48 flex-1"
        :placeholder="translateText('onboarding.publicSearchPlaceholder')"
      />
      <UButton
        color="primary"
        :loading="loading"
        @click="handleSearch"
      >
        {{ translateText('onboarding.publicSearch') }}
      </UButton>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <p
      v-else-if="emptyReason === 'noResults'"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      {{ translateText('onboarding.publicNoResults') }}
    </p>
    <p
      v-else-if="emptyReason === 'none' && !loading"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      {{ translateText('onboarding.publicEmpty') }}
    </p>

    <ul
      v-if="rooms.length"
      class="max-h-64 divide-y divide-gray-100 overflow-auto dark:divide-gray-800"
    >
      <li
        v-for="room in rooms"
        :key="room.roomId"
        class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <p class="truncate font-medium text-gray-900 dark:text-gray-100">
            {{ room.name || room.canonicalAlias || room.roomId }}
          </p>
          <p
            v-if="room.topic"
            class="line-clamp-2 text-xs text-gray-500 dark:text-gray-400"
          >
            {{ room.topic }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ room.numJoinedMembers ?? '–' }}
            {{ translateText('onboarding.publicMembers') }}
          </p>
        </div>
        <UButton
          size="sm"
          color="primary"
          :loading="joiningId === room.roomId"
          @click="handleJoin(room)"
        >
          {{ translateText('onboarding.publicJoin') }}
        </UButton>
      </li>
    </ul>

    <UButton
      v-if="nextBatch"
      color="neutral"
      variant="soft"
      block
      :loading="loading"
      @click="handleLoadMore"
    >
      {{ translateText('onboarding.publicLoadMore') }}
    </UButton>
  </div>
</template>
