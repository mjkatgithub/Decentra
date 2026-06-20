<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import { parseMatrixInviteTargets } from '~/utils/parseMatrixInviteTargets'

const props = defineProps<{
  targetRoomId: string
  targetLabel: string
}>()

const emit = defineEmits<{
  close: []
  invited: []
}>()

const { translateText } = useAppI18n()
const { userId, searchUsersDirectory, inviteUsersToRoom } = useMatrixClient()

const manualInput = ref('')
const searchTerm = ref('')
const searchBusy = ref(false)
const searchResults = ref<
  Array<{ userId: string; displayName?: string }>
>([])
const pickedUserIds = ref<string[]>([])
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const homeserverDomain = computed(() => {
  const selfId = userId.value
  if (!selfId || !selfId.includes(':')) {
    return ''
  }
  return selfId.slice(selfId.indexOf(':') + 1)
})

function addPickedUser(matrixUserId: string) {
  if (pickedUserIds.value.includes(matrixUserId)) {
    return
  }
  pickedUserIds.value = [...pickedUserIds.value, matrixUserId]
}

function removePickedUser(matrixUserId: string) {
  pickedUserIds.value = pickedUserIds.value.filter(
    (entry) => entry !== matrixUserId,
  )
}

function mergeManualIntoPicked() {
  const parsed = parseMatrixInviteTargets(
    manualInput.value,
    homeserverDomain.value,
  )
  for (const matrixUserId of parsed) {
    addPickedUser(matrixUserId)
  }
  manualInput.value = ''
}

async function handleSearchUsers() {
  searchResults.value = []
  const term = searchTerm.value.trim()
  if (term.length < 2) {
    return
  }
  searchBusy.value = true
  errorMessage.value = ''
  try {
    searchResults.value = await searchUsersDirectory({
      term,
      limit: 15,
    })
  } catch (thrownError) {
    errorMessage.value =
      thrownError instanceof Error
        ? thrownError.message
        : String(thrownError)
  } finally {
    searchBusy.value = false
  }
}

async function handleSubmit() {
  mergeManualIntoPicked()
  if (pickedUserIds.value.length === 0) {
    errorMessage.value = translateText('invite.noUsers')
    return
  }
  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await inviteUsersToRoom(
      props.targetRoomId,
      pickedUserIds.value,
    )
    if (result.failed.length > 0) {
      errorMessage.value = result.failed
        .map((entry) => `${entry.userId}: ${entry.error}`)
        .join('\n')
    }
    if (result.invited.length > 0) {
      successMessage.value = translateText('invite.success', {
        count: String(result.invited.length),
      })
      emit('invited')
    }
  } catch (thrownError) {
    errorMessage.value =
      thrownError instanceof Error
        ? thrownError.message
        : String(thrownError)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border
           border-gray-200 bg-white p-5 shadow-lg dark:border-gray-800
           dark:bg-gray-900"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {{ translateText('invite.title') }}
        </h2>
        <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
          {{ targetLabel }}
        </p>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="translateText('invite.close')"
        @click="emit('close')"
      />
    </div>

    <UFormField :label="translateText('invite.manualLabel')">
      <UTextarea
        v-model="manualInput"
        :rows="2"
        :placeholder="translateText('invite.manualPlaceholder')"
      />
    </UFormField>

    <div class="rounded border border-dashed border-gray-300 p-3
                dark:border-gray-600">
      <p class="text-xs text-gray-600 dark:text-gray-400">
        {{ translateText('invite.searchHint') }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <UInput
          v-model="searchTerm"
          size="sm"
          class="min-w-48 flex-1"
          :placeholder="translateText('invite.searchPlaceholder')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          :loading="searchBusy"
          @click="handleSearchUsers"
        >
          {{ translateText('invite.searchButton') }}
        </UButton>
      </div>
      <ul
        v-if="searchResults.length"
        class="mt-2 max-h-32 overflow-auto text-sm"
      >
        <li
          v-for="row in searchResults"
          :key="row.userId"
          class="flex items-center justify-between gap-2 border-b
                 border-gray-100 py-1 dark:border-gray-800"
        >
          <span class="min-w-0 truncate">
            {{ row.displayName || row.userId }}
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            @click="addPickedUser(row.userId)"
          >
            {{ translateText('invite.addUser') }}
          </UButton>
        </li>
      </ul>
    </div>

    <div v-if="pickedUserIds.length" class="flex flex-wrap gap-1">
      <span
        v-for="pickedId in pickedUserIds"
        :key="pickedId"
        class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2
               py-0.5 text-xs dark:bg-gray-800"
      >
        {{ pickedId }}
        <button
          type="button"
          class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          @click="removePickedUser(pickedId)"
        >
          ×
        </button>
      </span>
    </div>

    <UAlert
      v-if="successMessage"
      color="success"
      :title="successMessage"
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UButton
      color="primary"
      block
      :loading="submitting"
      @click="handleSubmit"
    >
      {{ translateText('invite.submit') }}
    </UButton>
  </div>
</template>
