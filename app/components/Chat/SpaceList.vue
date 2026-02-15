<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

interface SpaceItem {
  id: string
  name: string
  avatarUrl?: string
}

defineProps<{
  spaces: SpaceItem[]
  selectedSpaceId: string | null
  expanded: boolean
}>()

const emit = defineEmits<{
  selectSpace: [spaceId: string]
  createSpace: []
  toggleExpanded: []
}>()

const { translateText } = useAppI18n()
const failedAvatarSpaceIds = ref<string[]>([])

function selectSpace(spaceId: string) {
  emit('selectSpace', spaceId)
}

function getInitial(spaceName: string): string {
  return spaceName.trim().charAt(0).toUpperCase() || '?'
}

function hasUsableAvatar(space: SpaceItem): boolean {
  return Boolean(space.avatarUrl) && !failedAvatarSpaceIds.value.includes(space.id)
}

function markAvatarAsFailed(spaceId: string) {
  if (!failedAvatarSpaceIds.value.includes(spaceId)) {
    failedAvatarSpaceIds.value.push(spaceId)
  }
}
</script>

<template>
  <nav
    class="flex h-full flex-col border-r border-gray-200 bg-gray-50 p-2
           dark:border-gray-800 dark:bg-gray-950"
    :class="expanded ? 'w-64' : 'w-[72px]'"
    aria-label="Spaces"
  >
    <div class="mb-3 flex items-center justify-between gap-1">
      <p
        class="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500
               dark:text-gray-400"
      >
        {{ expanded ? translateText('layout.spaces') : 'S' }}
      </p>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="expanded ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        :aria-label="expanded
          ? translateText('layout.collapseSpaces')
          : translateText('layout.expandSpaces')"
        @click="emit('toggleExpanded')"
      />
    </div>

    <div class="flex flex-1 flex-col gap-2 overflow-y-auto">
      <div
        v-for="space in spaces"
        :key="space.id"
        class="flex items-center gap-2"
      >
        <button
          type="button"
          class="group flex h-12 min-h-12 w-12 min-w-12 items-center justify-center
                 rounded-2xl border transition hover:-translate-y-px"
          :class="selectedSpaceId === space.id
            ? 'border-primary-500 bg-primary-500/20 text-primary-500'
            : 'border-gray-200 bg-white/90 text-gray-700 hover:border-primary-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-primary-500/60'"
          @click="selectSpace(space.id)"
        >
          <img
            v-if="hasUsableAvatar(space)"
            :src="space.avatarUrl"
            :alt="space.name"
            class="h-8 w-8 rounded-full object-cover"
            @error="markAvatarAsFailed(space.id)"
          >
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full
                   bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700
                   dark:text-gray-200"
          >
            {{ getInitial(space.name) }}
          </span>
        </button>

        <button
          v-if="expanded"
          type="button"
          class="min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm font-medium
                 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="selectedSpaceId === space.id
            ? 'bg-primary-500/15 text-primary-500'
            : 'text-gray-700 dark:text-gray-200'"
          @click="selectSpace(space.id)"
        >
          <span class="block truncate">{{ space.name }}</span>
        </button>
      </div>
    </div>

    <div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        class="w-full justify-center"
        :class="expanded ? 'rounded-xl' : 'h-11 rounded-2xl'"
        @click="emit('createSpace')"
      >
        <span v-if="expanded">{{ translateText('layout.createSpace') }}</span>
      </UButton>
    </div>
  </nav>
</template>
