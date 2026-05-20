<script setup lang="ts">
import type { ChatTimelineReply } from '~/utils/chatTimeline'
import { useAppI18n } from '~/composables/useAppI18n'

const props = defineProps<{
  replyTo: ChatTimelineReply
  displayUrl?: string
  loading?: boolean
  clickable?: boolean
}>()

const emit = defineEmits<{
  activate: []
}>()

const { translateText } = useAppI18n()

const isImageReply = () => props.replyTo.msgtype === 'm.image'
const isVideoReply = () => props.replyTo.msgtype === 'm.video'
const showMediaThumb = () =>
  Boolean(props.replyTo.media) && (isImageReply() || isVideoReply())

function onActivate() {
  if (!props.clickable) {
    return
  }
  emit('activate')
}

function onKeydown(keyEvent: KeyboardEvent) {
  if (!props.clickable) {
    return
  }
  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
    keyEvent.preventDefault()
    emit('activate')
  }
}
</script>

<template>
  <div
    class="reply-preview mt-1 rounded border border-gray-200 text-xs
           text-gray-600 dark:border-gray-700 dark:text-gray-300"
    :class="[
      clickable
        ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/60'
        : '',
    ]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    :aria-label="clickable ? translateText('chat.replyQuoteJump') : undefined"
    @click.stop="onActivate"
    @keydown="onKeydown"
  >
    <div
      class="flex gap-2 px-2 py-1"
      :class="showMediaThumb() ? 'items-start' : ''"
    >
      <div
        v-if="showMediaThumb()"
        class="relative h-12 w-12 shrink-0 overflow-hidden rounded
               border border-gray-200 bg-gray-50 dark:border-gray-700
               dark:bg-gray-950"
      >
        <div
          v-if="loading"
          class="flex h-full w-full items-center justify-center"
        >
          <span class="text-[10px] text-gray-400">…</span>
        </div>
        <img
          v-else-if="displayUrl"
          :src="displayUrl"
          :alt="replyTo.body"
          class="h-full w-full object-cover"
        />
        <div
          v-else-if="isVideoReply()"
          class="flex h-full w-full flex-col items-center justify-center
                 gap-0.5 text-gray-500 dark:text-gray-400"
        >
          <UIcon name="i-lucide-video" class="size-4 shrink-0" />
          <span class="text-[10px] leading-none">
            {{ translateText('chat.replyVideo') }}
          </span>
        </div>
        <div
          v-else
          class="flex h-full w-full items-center justify-center
                 text-[10px] text-gray-400"
        >
          {{ replyTo.body }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium">
          {{ replyTo.senderName }}
        </p>
        <p
          v-if="!showMediaThumb() || replyTo.body"
          class="truncate"
        >
          <template v-if="isVideoReply() && !showMediaThumb()">
            {{ translateText('chat.replyVideo') }}
          </template>
          <template v-else>
            {{ replyTo.body }}
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
