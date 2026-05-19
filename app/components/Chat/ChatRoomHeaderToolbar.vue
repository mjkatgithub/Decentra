<script setup lang="ts">
import { useAppI18n } from "~/composables/useAppI18n";

defineProps<{
  threadsActive?: boolean;
  pinnedActive?: boolean;
  membersActive?: boolean;
}>();

const emit = defineEmits<{
  openThreads: [];
  openPinned: [];
  openMembers: [];
}>();

const { translateText } = useAppI18n();
</script>

<template>
  <div class="flex shrink-0 items-center gap-1">
    <UButton
      type="button"
      size="sm"
      color="neutral"
      :variant="threadsActive ? 'soft' : 'ghost'"
      icon="i-lucide-messages-square"
      :aria-label="
        threadsActive
          ? translateText('chat.closeRoomThreads')
          : translateText('chat.openRoomThreads')
      "
      :title="
        threadsActive
          ? translateText('chat.closeRoomThreads')
          : translateText('chat.openRoomThreads')
      "
      @click="emit('openThreads')"
    />
    <UButton
      type="button"
      size="sm"
      color="neutral"
      :variant="pinnedActive ? 'soft' : 'ghost'"
      icon="i-lucide-pin"
      :aria-label="
        pinnedActive
          ? translateText('chat.closePinnedMessages')
          : translateText('chat.openPinnedMessages')
      "
      :title="
        pinnedActive
          ? translateText('chat.closePinnedMessages')
          : translateText('chat.openPinnedMessages')
      "
      @click="emit('openPinned')"
    />
    <UButton
      type="button"
      size="sm"
      color="neutral"
      :variant="membersActive ? 'soft' : 'ghost'"
      icon="i-lucide-users"
      :aria-label="translateText('layout.toggleMembers')"
      :title="translateText('layout.toggleMembers')"
      @click="emit('openMembers')"
    />
  </div>
</template>
