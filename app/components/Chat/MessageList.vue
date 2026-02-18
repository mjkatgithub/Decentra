<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

interface MessageItem {
  id: string
  kind: 'message' | 'notice'
  isDecryptionError?: boolean
  senderId: string
  senderName: string
  avatarUrl?: string
  body: string
  readBy?: Array<{
    userId: string
    displayName: string
    avatarUrl?: string
  }>
}

defineProps<{
  messages: MessageItem[]
  canLoadOlder?: boolean
  loadingOlder?: boolean
}>()

const emit = defineEmits<{
  loadOlder: []
}>()

const { translateText } = useAppI18n()
</script>

<template>
  <div class="flex flex-1 flex-col overflow-y-auto p-4">
    <div
      v-if="canLoadOlder && messages.length > 0"
      class="mb-4 flex justify-center"
    >
      <UButton
        size="sm"
        variant="outline"
        :loading="loadingOlder"
        @click="emit('loadOlder')"
      >
        {{ translateText('chat.loadOlder') }}
      </UButton>
    </div>
    <template v-if="messages.length === 0">
      <p class="py-8 text-center text-gray-500 dark:text-gray-400">
        {{ translateText('chat.noMessages') }}
      </p>
    </template>
    <template v-else>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="mb-4"
      >
        <template v-if="msg.kind === 'notice'">
          <p
            class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs
                   text-gray-600 dark:border-gray-800 dark:bg-gray-900
                   dark:text-gray-300"
            :class="msg.isDecryptionError
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
              : ''"
          >
            {{ msg.body }}
          </p>
        </template>
        <template v-else>
          <div class="flex items-start gap-3">
            <img
              v-if="msg.avatarUrl"
              :src="msg.avatarUrl"
              :alt="msg.senderName"
              class="mt-0.5 h-10 w-10 rounded-full object-cover"
            >
            <div
              v-else
              class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full
                     bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700
                     dark:text-gray-200"
            >
              {{ msg.senderName.trim().charAt(0).toUpperCase() || '?' }}
            </div>

            <div class="min-w-0 flex-1">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ msg.senderName }}
              </span>
              <p class="text-sm wrap-break-word">
                {{ msg.body }}
              </p>

              <div
                v-if="msg.readBy && msg.readBy.length > 0"
                class="mt-1 flex items-center justify-end"
              >
                <div class="flex -space-x-2">
                  <div
                    v-for="reader in msg.readBy.slice(0, 5)"
                    :key="`${msg.id}-${reader.userId}`"
                    class="h-4 w-4 overflow-hidden rounded-full border border-white
                           bg-gray-200 dark:border-gray-900 dark:bg-gray-700"
                    :title="reader.displayName"
                  >
                    <img
                      v-if="reader.avatarUrl"
                      :src="reader.avatarUrl"
                      :alt="reader.displayName"
                      class="h-full w-full object-cover"
                    >
                    <span
                      v-else
                      class="flex h-full w-full items-center justify-center text-[8px]
                             font-semibold text-gray-700 dark:text-gray-200"
                    >
                      {{ reader.displayName.trim().charAt(0).toUpperCase() || '?' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
