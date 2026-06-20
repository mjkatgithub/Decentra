<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'

const { translateText } = useAppI18n()
const {
  userId,
  getOrCreateDirectMessageRoom,
  buildDirectMessageShareLink,
  buildOwnMatrixToLink,
  searchUsersDirectory
} = useMatrixClient()

const emit = defineEmits<{
  back: []
  started: [roomId: string]
}>()

const peerInput = ref('')
const busy = ref(false)
const errorMessage = ref('')
const searchTerm = ref('')
const searchBusy = ref(false)
const searchResults = ref<
  Array<{ userId: string; displayName?: string }>
>([])

const copyStatus = ref<'idle' | 'ok' | 'fail'>('idle')

const peerShareLink = computed(() => {
  try {
    if (!peerInput.value.trim()) {
      return ''
    }
    return buildDirectMessageShareLink(peerInput.value)
  } catch {
    return ''
  }
})

const ownShareLink = computed(() => buildOwnMatrixToLink())

async function handleStart() {
  errorMessage.value = ''
  busy.value = true
  try {
    const roomId = await getOrCreateDirectMessageRoom(peerInput.value)
    emit('started', roomId)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = false
  }
}

async function handleSearchUsers() {
  searchResults.value = []
  const term = searchTerm.value.trim()
  if (term.length < 2) {
    return
  }
  searchBusy.value = true
  try {
    searchResults.value = await searchUsersDirectory({
      term,
      limit: 15
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error)
  } finally {
    searchBusy.value = false
  }
}

function pickUser(id: string) {
  peerInput.value = id
}

async function copyText(text: string) {
  if (!text || !import.meta.client) {
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = 'ok'
    window.setTimeout(() => {
      copyStatus.value = 'idle'
    }, 2000)
  } catch {
    copyStatus.value = 'fail'
  }
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex items-start justify-between gap-2">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
        {{ translateText('onboarding.dmTitle') }}
      </h2>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        @click="emit('back')"
      >
        {{ translateText('onboarding.back') }}
      </UButton>
    </div>

    <UFormField :label="translateText('onboarding.dmPeerLabel')">
      <UInput
        v-model="peerInput"
        :placeholder="translateText('onboarding.dmPeerPlaceholder')"
      />
    </UFormField>

    <div v-if="userId" class="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
      <p class="font-medium text-gray-800 dark:text-gray-200">
        {{ translateText('onboarding.shareOwnLink') }}
      </p>
      <p class="mt-1 break-all text-gray-600 dark:text-gray-400">
        {{ ownShareLink }}
      </p>
      <UButton
        class="mt-2"
        size="xs"
        color="neutral"
        variant="soft"
        @click="copyText(ownShareLink)"
      >
        {{ translateText('onboarding.copyLink') }}
      </UButton>
    </div>

    <div v-if="peerShareLink" class="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
      <p class="font-medium text-gray-800 dark:text-gray-200">
        {{ translateText('onboarding.sharePeerLink') }}
      </p>
      <p class="mt-1 break-all text-gray-600 dark:text-gray-400">
        {{ peerShareLink }}
      </p>
      <UButton
        class="mt-2"
        size="xs"
        color="neutral"
        variant="soft"
        @click="copyText(peerShareLink)"
      >
        {{ translateText('onboarding.copyLink') }}
      </UButton>
    </div>

    <div class="rounded border border-dashed border-gray-300 p-3 dark:border-gray-600">
      <p class="text-xs text-gray-600 dark:text-gray-400">
        {{ translateText('onboarding.dmSearchHint') }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <UInput
          v-model="searchTerm"
          size="sm"
          class="min-w-48 flex-1"
          :placeholder="translateText('onboarding.dmSearchPlaceholder')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          :loading="searchBusy"
          @click="handleSearchUsers"
        >
          {{ translateText('onboarding.dmSearchButton') }}
        </UButton>
      </div>
      <ul
        v-if="searchResults.length"
        class="mt-2 max-h-40 overflow-auto text-sm"
      >
        <li
          v-for="row in searchResults"
          :key="row.userId"
          class="flex items-center justify-between gap-2 border-b border-gray-100 py-1 dark:border-gray-800"
        >
          <span class="min-w-0 truncate">
            {{ row.displayName || row.userId }}
          </span>
          <UButton size="xs" color="neutral" variant="ghost" @click="pickUser(row.userId)">
            {{ translateText('onboarding.dmPickUser') }}
          </UButton>
        </li>
      </ul>
    </div>

    <UAlert
      v-if="copyStatus === 'ok'"
      color="success"
      :title="translateText('onboarding.copied')"
    />
    <UAlert
      v-if="copyStatus === 'fail'"
      color="error"
      :title="translateText('onboarding.copyFailed')"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UButton
      color="primary"
      block
      :loading="busy"
      :disabled="!peerInput.trim()"
      @click="handleStart"
    >
      {{ translateText('onboarding.dmStart') }}
    </UButton>
  </div>
</template>
