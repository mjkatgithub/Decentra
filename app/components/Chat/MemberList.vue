<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

type MemberStatus = 'online' | 'away' | 'offline' | 'unknown'

interface MemberItem {
  userId: string
  displayName: string
  status: MemberStatus
}

defineProps<{
  members: MemberItem[]
}>()

const { translateText } = useAppI18n()

function getStatusClass(status: MemberStatus): string {
  const statusClasses: Record<MemberStatus, string> = {
    online: 'bg-green-500',
    away: 'bg-amber-500',
    offline: 'bg-gray-500',
    unknown: 'bg-gray-400'
  }
  return statusClasses[status]
}

function getStatusLabel(status: MemberStatus): string {
  const statusLabels: Record<MemberStatus, string> = {
    online: translateText('layout.online'),
    away: translateText('layout.away'),
    offline: translateText('layout.offline'),
    unknown: translateText('layout.unknown')
  }
  return statusLabels[status]
}
</script>

<template>
  <aside
    class="flex h-full w-72 flex-col border-l border-gray-200 bg-gray-50
           dark:border-gray-800 dark:bg-gray-950"
  >
    <header
      class="border-b border-gray-200 px-3 py-2 text-sm font-semibold
             dark:border-gray-800"
    >
      {{ translateText('layout.members') }}
    </header>
    <div class="flex-1 overflow-y-auto p-2">
      <template v-if="members.length === 0">
        <p class="p-2 text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('layout.noMembers') }}
        </p>
      </template>
      <ul v-else class="space-y-1">
        <li
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-2 rounded-lg px-2 py-2"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            :class="getStatusClass(member.status)"
          />
          <span class="min-w-0 flex-1 truncate text-sm">
            {{ member.displayName }}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ getStatusLabel(member.status) }}
          </span>
        </li>
      </ul>
    </div>
  </aside>
</template>
