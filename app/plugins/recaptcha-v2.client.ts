import { install as installRecaptchaV2 } from 'vue3-recaptcha-v2'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(installRecaptchaV2)
})
