<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import { storeToRefs } from 'pinia'
import { useAuthSessionStore } from '~/stores/authSessionStore'
import logoBgUrl from '~/assets/logoBg.svg?url'

const { translateText } = useAppI18n()
const authSessionStore = useAuthSessionStore()
const { isLoggedIn, isSessionRestoreFinished } = storeToRefs(authSessionStore)

watchEffect(() => {
  if (!isSessionRestoreFinished.value) {
    return
  }
  if (isLoggedIn.value) {
    void navigateTo('/chat')
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <div
      v-if="!isSessionRestoreFinished"
      class="flex min-h-screen items-center justify-center"
    >
      <span class="text-gray-500">
        {{ translateText('common.loading') }}
      </span>
    </div>
    <div v-else class="min-h-screen">
      <header
        class="border-b border-gray-200/70 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85"
      >
        <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <p class="text-lg font-semibold text-white/70 dark:text-white/80">
            Decentra
          </p>
          <UButton to="/login" color="primary">
            {{ translateText('auth.signIn') }}
          </UButton>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl px-6 py-12 md:py-14">
        <section
          class="relative overflow-hidden rounded-2xl border border-white/10 p-8 md:p-10"
        >
          <img
            :src="logoBgUrl"
            alt=""
            aria-hidden="true"
            class="pointer-events-none absolute left-1/2 top-1/2 w-[100%] max-w-[1100px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
          >
          <div class="relative z-10 space-y-4">
            <p class="text-sm font-semibold uppercase tracking-wide text-primary-400">
              {{ translateText('landing.kicker') }}
            </p>
            <h1 class="max-w-2xl text-4xl font-bold leading-tight text-white md:text-6xl">
              {{ translateText('landing.title') }}
            </h1>
            <p class="max-w-2xl text-base text-gray-300 md:text-lg">
              {{ translateText('landing.subtitle') }}
            </p>

            <div class="grid gap-4 pt-4 md:grid-cols-3">
              <UCard class="bg-white/5 ring-1 ring-white/10">
                <div class="space-y-2">
                  <h2 class="text-base font-semibold text-white">
                    {{ translateText('landing.featureOneTitle') }}
                  </h2>
                  <p class="text-sm text-gray-300">
                    {{ translateText('landing.featureOneText') }}
                  </p>
                </div>
              </UCard>
              <UCard class="bg-white/5 ring-1 ring-white/10">
                <div class="space-y-2">
                  <h2 class="text-base font-semibold text-white">
                    {{ translateText('landing.featureTwoTitle') }}
                  </h2>
                  <p class="text-sm text-gray-300">
                    {{ translateText('landing.featureTwoText') }}
                  </p>
                </div>
              </UCard>
              <UCard class="bg-white/5 ring-1 ring-white/10">
                <div class="space-y-2">
                  <h2 class="text-base font-semibold text-white">
                    {{ translateText('landing.featureThreeTitle') }}
                  </h2>
                  <p class="text-sm text-gray-300">
                    {{ translateText('landing.featureThreeText') }}
                  </p>
                </div>
              </UCard>
            </div>

            <UCard
              class="mt-4 bg-white/5 ring-1 ring-white/10"
              :ui="{ body: 'p-4 sm:p-6 my-2.5' }"
            >
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-white">
                    {{ translateText('landing.downloadTitle') }}
                  </h2>
                  <p class="text-sm text-gray-300">
                    {{ translateText('landing.downloadPlaceholder') }}
                  </p>
                </div>
                <UButton color="neutral" variant="outline" disabled>
                  {{ translateText('landing.downloadCta') }}
                </UButton>
              </div>
            </UCard>

          </div>
        </section>
      </main>
    </div>
  </div>
</template>
