<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import type { RoomCategoryGroup } from '~/composables/chat/chatPageTypes'

const { translateText } = useAppI18n()

const props = defineProps<{
  spaceName: string
  spaceAvatarUrl?: string
  spaceTopic?: string
  memberCountLabel: string
  categories: RoomCategoryGroup[]
  canInvite: boolean
  joiningRoomId?: string | null
}>()

const emit = defineEmits<{
  'select-room': [roomId: string]
  'join-room': [roomId: string]
  invite: []
  'open-settings': []
}>()

const channelCategories = computed(() =>
  props.categories.filter(
    (category) =>
      category.rooms.length > 0 || category.kind === 'subspace',
  ),
)

const hasLobbyEntries = computed(() => channelCategories.value.length > 0)

function categoryIndentStyle(category: RoomCategoryGroup) {
  const depth = category.nestingDepth ?? 0
  if (category.kind !== 'subspace' || depth <= 1) {
    return undefined
  }
  const indentRem = (depth - 1) * 1.25
  return { marginLeft: `${indentRem}rem` }
}

function subspaceInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

function roomMemberLabel(count: number | undefined): string | null {
  if (count === undefined || count <= 0) {
    return null
  }
  return translateText('layout.spaceMembersCount', {
    count: String(count),
  })
}

function categoryTitleClass(category: RoomCategoryGroup): string {
  if (category.kind === 'root') {
    return 'truncate text-xs font-semibold uppercase tracking-wide'
      + ' text-gray-500 dark:text-gray-400'
  }
  return 'truncate text-sm font-semibold text-gray-800'
    + ' dark:text-gray-100'
}

function onRoomAction(roomId: string, isJoined: boolean) {
  if (isJoined) {
    emit('select-room', roomId)
    return
  }
  emit('join-room', roomId)
}

function onSubspaceAction(category: RoomCategoryGroup) {
  if (!category.subspaceRoomId) {
    return
  }
  if (category.isSubspaceJoined !== false) {
    return
  }
  emit('join-room', category.subspaceRoomId)
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-2xl flex-col gap-4 overflow-auto p-2"
    data-space-home-panel
  >
    <div
      class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm
             dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex items-center gap-3">
        <div
          v-if="spaceAvatarUrl"
          class="size-12 shrink-0 overflow-hidden rounded-lg bg-gray-200
                 dark:bg-gray-700"
        >
          <img
            :src="spaceAvatarUrl"
            :alt="spaceName"
            class="size-full object-cover"
          >
        </div>
        <div
          v-else
          class="flex size-12 shrink-0 items-center justify-center rounded-lg
                 bg-primary-100 text-primary-700 dark:bg-primary-900/40
                 dark:text-primary-300"
        >
          <UIcon name="i-lucide-layers" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h2
            class="truncate text-lg font-semibold text-gray-900
                   dark:text-gray-50"
          >
            {{
              translateText('spaceHome.welcome', { space: spaceName })
            }}
          </h2>
          <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {{ memberCountLabel }}
          </p>
          <p
            v-if="spaceTopic"
            class="mt-1 text-sm text-gray-500 dark:text-gray-400"
          >
            {{ spaceTopic }}
          </p>
        </div>
      </div>

      <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
        {{ translateText('spaceHome.subtitle') }}
      </p>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <UButton
          v-if="canInvite"
          color="primary"
          class="flex-1"
          @click="emit('invite')"
        >
          {{ translateText('invite.spaceMenu') }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          class="flex-1"
          @click="emit('open-settings')"
        >
          {{ translateText('layout.openSpaceSettings') }}
        </UButton>
      </div>
    </div>

    <div v-if="hasLobbyEntries" class="flex flex-col gap-3">
      <section
        v-for="category in channelCategories"
        :key="category.id"
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm
               dark:border-gray-800 dark:bg-gray-900"
        :style="categoryIndentStyle(category)"
        :data-lobby-category-depth="category.nestingDepth ?? 0"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <template v-if="category.kind === 'subspace'">
              <div
                v-if="category.subspaceAvatarUrl"
                class="size-8 shrink-0 overflow-hidden rounded-md
                       bg-gray-200 dark:bg-gray-700"
              >
                <img
                  :src="category.subspaceAvatarUrl"
                  :alt="category.name"
                  class="size-full object-cover"
                >
              </div>
              <div
                v-else
                class="flex size-8 shrink-0 items-center justify-center
                       rounded-md bg-primary-100 text-sm font-semibold
                       text-primary-700 dark:bg-primary-900/40
                       dark:text-primary-300"
              >
                {{ subspaceInitial(category.name) }}
              </div>
            </template>
            <h3 :class="categoryTitleClass(category)">
              {{ category.name }}
            </h3>
          </div>
          <UButton
            v-if="
              category.kind === 'subspace' &&
                category.isSubspaceJoined === false &&
                category.subspaceRoomId
            "
            size="xs"
            color="primary"
            variant="soft"
            :loading="joiningRoomId === category.subspaceRoomId"
            @click="onSubspaceAction(category)"
          >
            {{ translateText('spaceHome.joinSubspace') }}
          </UButton>
        </div>

        <div
          v-if="category.rooms.length === 0"
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          {{ translateText('spaceHome.emptySubspaceChannels') }}
        </div>

        <div
          v-for="room in category.rooms"
          :key="room.roomId"
          class="flex items-center gap-2 border-b border-gray-100 py-2
                 last:border-b-0 dark:border-gray-800"
        >
          <div
            v-if="room.avatarUrl"
            class="size-7 shrink-0 overflow-hidden rounded-md bg-gray-200
                   dark:bg-gray-700"
          >
            <img
              :src="room.avatarUrl"
              :alt="room.name"
              class="size-full object-cover"
            >
          </div>
          <UIcon
            v-else
            name="i-lucide-hash"
            class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
          />
          <div class="min-w-0 flex-1">
            <span
              class="block truncate text-sm text-gray-800
                     dark:text-gray-100"
            >
              {{ room.name }}
            </span>
            <span
              v-if="roomMemberLabel(room.memberCount)"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ roomMemberLabel(room.memberCount) }}
            </span>
          </div>
          <UButton
            v-if="room.isJoined !== false"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-right"
            :data-space-home-room-id="room.roomId"
            :aria-label="
              translateText('spaceHome.openChannel', { name: room.name })
            "
            @click="onRoomAction(room.roomId, true)"
          />
          <UButton
            v-else
            size="xs"
            color="primary"
            variant="soft"
            :loading="joiningRoomId === room.roomId"
            :data-space-home-room-id="room.roomId"
            @click="onRoomAction(room.roomId, false)"
          >
            {{ translateText('spaceHome.joinChannel') }}
          </UButton>
        </div>
      </section>
    </div>

    <p
      v-else
      class="rounded-lg border border-dashed border-gray-300 px-4 py-6
             text-center text-sm text-gray-500 dark:border-gray-700
             dark:text-gray-400"
    >
      {{ translateText('spaceHome.emptyChannels') }}
    </p>
  </div>
</template>
