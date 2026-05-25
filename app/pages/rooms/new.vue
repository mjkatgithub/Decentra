<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import { parseMatrixInviteTargets } from '~/utils/parseMatrixInviteTargets'

const route = useRoute()
const { translateText } = useAppI18n()
const {
  userId,
  createGroupRoom,
  createMatrixSpace,
  searchUsersDirectory,
} = useMatrixClient()

const name = ref('')
const topic = ref('')
const visibility = ref<'private' | 'public'>('private')
const inviteInput = ref('')
const inviteSearchTerm = ref('')
const inviteSearchBusy = ref(false)
const inviteSearchResults = ref<
  Array<{ userId: string; displayName?: string }>
>([])
const pickedInviteUserIds = ref<string[]>([])
const submitting = ref(false)
const errorMessage = ref('')

function readQueryParam(key: string): string {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim() : ''
}

const rootSpaceId = computed(() =>
  readQueryParam('root') || readQueryParam('space'),
)

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

const showInviteOnCreate = computed(() => createKind.value === 'room')

const homeserverDomain = computed(() => {
  const selfId = userId.value
  if (!selfId || !selfId.includes(':')) {
    return ''
  }
  return selfId.slice(selfId.indexOf(':') + 1)
})

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

function addInviteUser(matrixUserId: string) {
  if (pickedInviteUserIds.value.includes(matrixUserId)) {
    return
  }
  pickedInviteUserIds.value = [...pickedInviteUserIds.value, matrixUserId]
}

function collectInviteUserIds(): string[] {
  const fromField = parseMatrixInviteTargets(
    inviteInput.value,
    homeserverDomain.value,
  )
  const merged = new Set(
    [...pickedInviteUserIds.value, ...fromField].map((entry) =>
      entry.toLowerCase(),
    ),
  )
  return [...merged].map((lower) => {
    const found = [...pickedInviteUserIds.value, ...fromField].find(
      (entry) => entry.toLowerCase() === lower,
    )
    return found ?? lower
  })
}

async function handleInviteSearch() {
  inviteSearchResults.value = []
  const term = inviteSearchTerm.value.trim()
  if (term.length < 2) {
    return
  }
  inviteSearchBusy.value = true
  try {
    inviteSearchResults.value = await searchUsersDirectory({
      term,
      limit: 15,
    })
  } catch (thrownError) {
    errorMessage.value =
      thrownError instanceof Error
        ? thrownError.message
        : String(thrownError)
  } finally {
    inviteSearchBusy.value = false
  }
}

async function handleCreate() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const linkParentId = parentSpaceId.value
    const inviteUserIds = showInviteOnCreate.value
      ? collectInviteUserIds()
      : []
    const sharedInput = {
      name: name.value,
      topic: topic.value,
      visibility: visibility.value,
      ...(linkParentId ? { parentSpaceId: linkParentId } : {}),
      ...(insertIndex.value !== undefined
        ? { insertIndex: insertIndex.value }
        : {}),
      ...(inviteUserIds.length > 0 ? { inviteUserIds } : {}),
    }
    const roomId =
      createKind.value === 'space'
        ? await createMatrixSpace(sharedInput)
        : await createGroupRoom(sharedInput)
    await navigateTo({
      path: '/chat',
      query: rootSpaceId.value ? { room: roomId, root: rootSpaceId.value } : { room: roomId },
    })
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
          v-if="parentSpaceId && rootSpaceId"
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

        <div
          v-if="showInviteOnCreate"
          class="space-y-3 rounded-lg border border-gray-200 p-3
                 dark:border-gray-800"
        >
          <p class="text-sm font-medium">
            {{ translateText('rooms.createInviteLabel') }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ translateText('rooms.createInviteHint') }}
          </p>
          <UTextarea
            v-model="inviteInput"
            :rows="2"
            :placeholder="translateText('invite.manualPlaceholder')"
          />
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="inviteSearchTerm"
              size="sm"
              class="min-w-48 flex-1"
              :placeholder="translateText('invite.searchPlaceholder')"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :loading="inviteSearchBusy"
              @click="handleInviteSearch"
            >
              {{ translateText('invite.searchButton') }}
            </UButton>
          </div>
          <ul
            v-if="inviteSearchResults.length"
            class="max-h-32 overflow-auto text-sm"
          >
            <li
              v-for="row in inviteSearchResults"
              :key="row.userId"
              class="flex items-center justify-between gap-2 py-1"
            >
              <span class="min-w-0 truncate">
                {{ row.displayName || row.userId }}
              </span>
              <UButton
                size="xs"
                variant="ghost"
                @click="addInviteUser(row.userId)"
              >
                {{ translateText('invite.addUser') }}
              </UButton>
            </li>
          </ul>
          <div
            v-if="pickedInviteUserIds.length"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="pickedId in pickedInviteUserIds"
              :key="pickedId"
              class="rounded-full bg-gray-100 px-2 py-0.5 text-xs
                     dark:bg-gray-800"
            >
              {{ pickedId }}
            </span>
          </div>
        </div>

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
