<script setup lang="ts">
import type { SignupTermsPolicyItem } from '~/composables/matrix/matrixRegistrationUia'
import { computed, ref } from 'vue'
import { useAppI18n } from '~/composables/useAppI18n'

const props = defineProps<{
  policies: SignupTermsPolicyItem[]
}>()

const emit = defineEmits<{
  continue: []
}>()

const consent = ref(false)
const { translateText } = useAppI18n()

const canProceed = computed(() => {
  return consent.value &&
    props.policies.length > 0
})

function onContinue(): void {
  if (canProceed.value) {
    emit('continue')
  }
}
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="policies.length === 0"
      class="text-sm text-gray-600 dark:text-gray-300"
    >
      {{ translateText('auth.signUpTermsEmptyPolicies') }}
    </p>
    <ul
      v-else
      class="space-y-3 text-sm"
    >
      <li
        v-for="item in policies"
        :key="item.policyId + item.version"
        class="rounded border border-gray-200/70 p-3 dark:border-gray-700"
      >
        <a
          :href="item.url"
          class="font-medium text-sky-500 underline underline-offset-2 hover:text-sky-400"
          target="_blank"
          rel="noopener noreferrer"
          :title="item.url"
        >
          {{ item.name }}
        </a>
      </li>
    </ul>
    <UCheckbox
      v-if="policies.length > 0"
      v-model="consent"
      :disabled="policies.length === 0"
    >
      {{ translateText('auth.signUpTermsAcceptCheckbox') }}
    </UCheckbox>
    <UButton
      class="w-full justify-center"
      :disabled="!canProceed"
      @click="onContinue"
    >
      {{ translateText('auth.signUpTermsContinue') }}
    </UButton>
  </div>
</template>
