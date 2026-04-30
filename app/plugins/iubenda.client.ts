export default defineNuxtPlugin(() => {
  const runtimePublic = useRuntimeConfig().public
  const siteIdRaw = String(runtimePublic.iubendaSiteId ?? '').trim()
  const cookiePolicyIdRaw = String(
    runtimePublic.iubendaCookiePolicyId ?? ''
  ).trim()

  const siteId = Number(siteIdRaw)
  const cookiePolicyId = Number(cookiePolicyIdRaw)

  if (
    !siteIdRaw ||
    !cookiePolicyIdRaw ||
    Number.isNaN(siteId) ||
    Number.isNaN(cookiePolicyId)
  ) {
    return
  }

  const lang = String(runtimePublic.iubendaLang ?? 'de').trim() || 'de'

  const configuration = {
    siteId,
    cookiePolicyId,
    lang,
    priorConsent: true,
    perPurposeConsent: true,
    consentOnContinuedBrowsing: false,
    gdprAppliesGlobally: false,
    banner: {
      acceptButtonDisplay: true,
      customizeButtonDisplay: true,
      rejectButtonDisplay: true,
      position: 'float-bottom-right'
    }
  }

  useHead({
    script: [
      {
        key: 'iubenda-cs-configuration',
        innerHTML:
          `var _iub=_iub||{};_iub.csConfiguration=` +
          `${JSON.stringify(configuration)};`,
        type: 'text/javascript'
      },
      {
        key: 'iubenda-cs-core',
        src: 'https://cdn.iubenda.com/cs/iubenda_cs.js',
        type: 'text/javascript',
        defer: true,
        async: true
      }
    ]
  })
})
