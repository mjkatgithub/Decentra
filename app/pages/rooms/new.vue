<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

const route = useRoute()
const { translateText } = useAppI18n()
const { createGroupRoom, createMatrixSpace } = useMatrixClient()

const name = ref('')
const topic = ref('')
const visibility = ref<'private' | 'public'>('private')
const submitting = ref(false)
const errorMessage = ref('')

function readQueryParam(key: string): string {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim() : ''
}

/** Top-level space for the rail (never a nested subspace id). */
const rootSpaceId = computed(() =>
  readQueryParam('root') || readQueryParam('space'),
)

/** Parent space/subspace where m.space.child will be sent. */
const parentSpaceId = computed(() =>
  readQueryParam('parent') || rootSpaceId.value,
)

const insertIndex = computed(() => {
  const raw = readQueryParam('insertIndex')
  if (!raw) {
    return undefined
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
})

const createKind = computed<'room' | 'space'>(() =>
  readQueryParam('kind') === 'space' ? 'space' : 'room',
)

const pageTitle = computed(() =>
  createKind.value === 'space'
    ? translateText('rooms.createSpaceTitle')
    : translateText('rooms.createTitle'),
)

const pageDescription = computed(() =>
  createKind.value === 'space'
    ? translateText('rooms.createSpaceDescription')
    : translateText('rooms.createDescription'),
)

const submitLabel = computed(() =>
  createKind.value === 'space'
    ? translateText('rooms.createSpaceSubmit')
    : translateText('rooms.createSubmit'),
)

const backToChatLocation = computed(() => {
  if (!rootSpaceId.value) {
    return '/chat'
  }
  return {
    path: '/chat',
    query: { root: rootSpaceId.value },
  }
})

async function handleCreate() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const linkParentId = parentSpaceId.value
    const sharedInput = {
      name: name.value,
      topic: topic.value,
      visibility: visibility.value,
      ...(linkParentId ? { parentSpaceId: linkParentId } : {}),
      ...(insertIndex.value !== undefined
        ? { insertIndex: insertIndex.value }
        : {}),
    }
    const roomId =
      createKind.value === 'space'
        ? await createMatrixSpace(sharedInput)
        : await createGroupRoom(sharedInput)
    const query: Record<string, string> = { room: roomId }
    if (rootSpaceId.value) {
      query.root = rootSpaceId.value
    }
    await navigateTo({ path: '/chat', query })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-2xl items-start p-4">
    <UCard class="w-full">
      <template #header>
        <h1 class="text-xl font-semibold">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ pageDescription }}
        </p>
        <p
          v-if="parentSpaceId"
          class="mt-1 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ translateText('rooms.createInSpaceHint') }}
        </p>
      </template>

      <div class="space-y-4">
        <UFormField :label="translateText('rooms.createName')">
          <UInput v-model="name" />
        </UFormField>
        <UFormField :label="translateText('rooms.createTopic')">
          <UInput v-model="topic" />
        </UFormField>
        <UFormField :label="translateText('rooms.createVisibility')">
          <div class="flex flex-col gap-2 sm:flex-row">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="visibility"
                type="radio"
                value="private"
                class="accent-primary"
              >
              {{ translateText('rooms.visibilityPrivate') }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="visibility"
                type="radio"
                value="public"
                class="accent-primary"
              >
              {{ translateText('rooms.visibilityPublic') }}
            </label>
          </div>
        </UFormField>
        <UAlert
          v-if="errorMessage"
          color="error"
          :title="errorMessage"
        />
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="primary"
            :loading="submitting"
            :disabled="!name.trim()"
            @click="handleCreate"
          >
            {{ submitLabel }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            :to="backToChatLocation"
          >
            {{ translateText('settings.backToChat') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
