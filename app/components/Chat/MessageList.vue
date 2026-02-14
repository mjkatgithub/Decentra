<script setup lang="ts">
interface MessageItem {
  id: string
  sender: string
  body: string
}

defineProps<{
  messages: MessageItem[]
  canLoadOlder?: boolean
  loadingOlder?: boolean
}>()

const emit = defineEmits<{
  loadOlder: []
}>()
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
        Ältere Nachrichten laden
      </UButton>
    </div>
    <template v-if="messages.length === 0">
      <p class="py-8 text-center text-gray-500 dark:text-gray-400">
        Keine Nachrichten. Starte die Unterhaltung!
      </p>
    </template>
    <template v-else>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="mb-4 flex flex-col"
      >
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
          {{ msg.sender }}
        </span>
        <p class="text-sm wrap-break-word">
          {{ msg.body }}
        </p>
      </div>
    </template>
  </div>
</template>
