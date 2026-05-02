// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      iubendaSiteId: '',
      iubendaCookiePolicyId: '',
      iubendaLang: 'de',
      iubendaRecaptchaPurposeIds: '',
      iubendaPrivacyPolicyUrl: '',
      /**
       * Public HTTPS origin without path (delegated OAuth / MAS redirects).
       * Example: https://YOUR-NGROK.app — required for matrix.org OAuth.
       */
      siteUrl: '',
      matrixOidcClientId: ''
    }
  },
  app: {
    head: {
      title: 'Decentra',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  vite: {
    optimizeDeps: {
      exclude: ['@matrix-org/matrix-sdk-crypto-wasm']
    }
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  }
})
