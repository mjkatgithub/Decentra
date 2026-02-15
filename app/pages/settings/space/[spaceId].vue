<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'

const route = useRoute()
const { isLoggedIn } = useMatrixClient()
const { translateText } = useAppI18n()

if (!isLoggedIn.value) {
  navigateTo('/login')
}

const spaceId = computed(() => String(route.params.spaceId || ''))
const storageKey = computed(() => `decentra.space-name.${spaceId.value}`)
const editableSpaceName = ref('')
const savedMessage = ref('')

onMounted(() => {
  if (!import.meta.client) {
    return
  }
  editableSpaceName.value =
    window.localStorage.getItem(storageKey.value) || spaceId.value
})

function handleSave() {
  if (!import.meta.client) {
    return
  }
  window.localStorage.setItem(storageKey.value, editableSpaceName.value.trim())
  savedMessage.value = translateText('settings.saved')
}
</script>

<template>
  <div class="mx-auto flex min-h-screen w-full max-w-2xl items-start p-4">
    <UCard class="w-full">
      <template #header>
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">
            {{ translateText('settings.spaceTitle') }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ translateText('settings.spaceDescription') }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">{{ translateText('settings.spaceId') }}</span>
          <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
            {{ spaceId }}
          </code>
        </label>

        <label class="flex flex-col gap-2 text-sm">
          <span class="font-medium">{{ translateText('settings.spaceName') }}</span>
          <UInput v-model="editableSpaceName" />
        </label>

        <UAlert v-if="savedMessage" color="success" :title="savedMessage" />
      </div>

      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" @click="handleSave">
            {{ translateText('settings.save') }}
          </UButton>
          <UButton color="neutral" variant="soft" to="/chat">
            {{ translateText('settings.backToChat') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
