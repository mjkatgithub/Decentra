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
      matrixOidcClientId: '',
      /**
       * Optional remote debug log sink. When unset, Decentra only logs to the
       * browser console. When set, Decentra will POST NDJSON-ish payloads.
       *
       * Example: http://127.0.0.1:7476/ingest/<id> (local), or your Graylog.
       */
      debugLogIngestUrl: '',
      /**
       * Optional session id for remote log sink. Only sent when both this and
       * `debugLogSessionHeader` are configured.
       */
      debugLogSessionId: '',
      /**
       * Optional header name for session id, e.g. X-Debug-Session-Id.
       */
      debugLogSessionHeader: ''
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
