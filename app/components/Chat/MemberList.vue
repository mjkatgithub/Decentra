<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

type MemberStatus = 'online' | 'away' | 'busy' | 'offline' | 'unknown'

interface MemberItem {
  userId: string
  displayName: string
  avatarUrl?: string
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
    busy: 'bg-red-500',
    offline: 'bg-gray-500',
    unknown: 'bg-gray-400'
  }
  return statusClasses[status]
}

function getStatusLabel(status: MemberStatus): string {
  const statusLabels: Record<MemberStatus, string> = {
    online: translateText('layout.online'),
    away: translateText('layout.away'),
    busy: translateText('layout.busy'),
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
          <div class="relative h-8 w-8 shrink-0">
            <img
              v-if="member.avatarUrl"
              :src="member.avatarUrl"
              :alt="member.displayName"
              class="h-8 w-8 rounded-full object-cover"
            >
            <span
              v-else
              class="flex h-8 w-8 items-center justify-center rounded-full
                     bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700
                     dark:text-gray-200"
            >
              {{ member.displayName.trim().charAt(0).toUpperCase() || '?' }}
            </span>
            <span
              class="absolute -bottom-0.5 -right-0.5 inline-block h-3 w-3 rounded-full
                     border-2 border-gray-50 dark:border-gray-950"
              :class="getStatusClass(member.status)"
            />
          </div>
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
