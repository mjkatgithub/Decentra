<script setup lang="ts">
import { computed, ref } from 'vue'
import { RecaptchaV2 } from 'vue3-recaptcha-v2'
import { executeGoogleRecaptchaV3 } from '~/composables/recaptchaGoogle'
import { useSignupRecaptchaConsent } from '~/composables/useSignupRecaptchaConsent'
import { useAppI18n } from '~/composables/useAppI18n'

const props = defineProps<{
  siteKey: string
  version: 'v2' | 'v3'
}>()

const emit = defineEmits<{
  verified: [token: string]
}>()

const { translateText } = useAppI18n()
const {
  iubendaConfigured,
  privacyPolicyUrl,
  canLoadGoogleRecaptcha,
  grantLocalRecaptchaConsent,
  openCookiePreferences
} = useSignupRecaptchaConsent()

const v3Running = ref(false)
const v3Error = ref('')

const widgetAllowed = computed(() => canLoadGoogleRecaptcha())

const policyHref = computed(() => privacyPolicyUrl())

function onConsentContinue(): void {
  grantLocalRecaptchaConsent()
}

function openPrivacy(): void {
  const url = policyHref.value
  if (!url) {
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function runRecaptchaV3(): Promise<void> {
  v3Error.value = ''
  v3Running.value = true
  try {
    const token = await executeGoogleRecaptchaV3(props.siteKey, 'signup')
    emit('verified', token)
  } catch {
    v3Error.value = translateText('auth.signUpRecaptchaFailed')
  } finally {
    v3Running.value = false
  }
}

function onRecaptchaV2Verified(response: unknown): void {
  if (typeof response !== 'string' || !response.trim()) {
    return
  }
  emit('verified', response.trim())
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-400">
      {{ translateText('auth.signUpCaptchaConsentLead') }}
    </p>
    <p class="text-sm text-gray-400">
      {{ translateText('auth.signUpHomeserverPrivacyNotice') }}
    </p>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="policyHref"
        type="button"
        color="neutral"
        variant="outline"
        size="sm"
        @click="openPrivacy"
      >
        {{ translateText('auth.signUpPrivacyPolicyLink') }}
      </UButton>
      <UButton
        v-if="iubendaConfigured()"
        type="button"
        color="neutral"
        variant="outline"
        size="sm"
        @click="openCookiePreferences"
      >
        {{ translateText('auth.signUpCookieSettings') }}
      </UButton>
    </div>

    <div v-if="!widgetAllowed">
      <UButton
        type="button"
        class="w-full justify-center"
        @click="onConsentContinue"
      >
        {{ translateText('auth.signUpAgreeLoadRecaptcha') }}
      </UButton>
    </div>

    <template v-else>
      <ClientOnly>
        <RecaptchaV2
          v-if="version === 'v2'"
          :sitekey="siteKey"
          theme="dark"
          @load-callback="onRecaptchaV2Verified"
        />
        <div
          v-else
          class="space-y-2"
        >
          <UButton
            type="button"
            class="w-full justify-center"
            :loading="v3Running"
            @click="runRecaptchaV3"
          >
            {{ translateText('auth.signUpRunRecaptchaCheck') }}
          </UButton>
          <p
            v-if="v3Error"
            class="text-sm text-red-400"
          >
            {{ v3Error }}
          </p>
        </div>
      </ClientOnly>
    </template>
  </div>
</template>
