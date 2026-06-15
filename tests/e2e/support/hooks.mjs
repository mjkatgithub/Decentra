import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import { resolve } from 'node:path'
import { loadE2EEnv } from '../scripts/runtime-e2e-env.mjs'

setDefaultTimeout(120 * 1000)

let browser
let context
let page

const isHeadless = process.env.HEADLESS !== 'false'
loadE2EEnv(resolve(process.cwd()))

const SYNAPSE_E2E_STEP_MARKERS = [
  'I open the seeded test room',
  'I open the side seeded test room',
  'leave test dm room',
  'seeded test space channel',
  'seeded test space in the space rail',
  'main test room',
  'seeded space channel',
  'typing in the main test room',
]

function shouldValidateSynapseEnv(pickle) {
  if (!pickle?.steps) {
    return false
  }
  return pickle.steps.some((step) => {
    if (typeof step.text !== 'string') {
      return false
    }
    return SYNAPSE_E2E_STEP_MARKERS.some((marker) =>
      step.text.includes(marker),
    )
  })
}

function scenarioNeedsTouchContext(pickle) {
  if (!pickle?.tags) {
    return false
  }
  return pickle.tags.some((tag) => tag.name === '@mobile')
}

function validateSynapseEnv() {
  const requiredKeys = [
    'E2E_MATRIX_HOMESERVER',
    'E2E_MATRIX_USERNAME',
    'E2E_MATRIX_PASSWORD',
    'E2E_SECOND_MATRIX_USERNAME',
    'E2E_SECOND_MATRIX_PASSWORD',
  ]
  const missingKeys = requiredKeys.filter(
    (requiredKey) => !process.env[requiredKey],
  )
  if (missingKeys.length === 0) {
    return
  }
  throw new Error(`Missing Synapse E2E env: ${missingKeys.join(', ')}`)
}

BeforeAll(async function () {
  browser = await chromium.launch({ headless: isHeadless })
})

AfterAll(async function () {
  if (browser) await browser.close()
})

Before(async function ({ pickle }) {
  if (shouldValidateSynapseEnv(pickle)) {
    validateSynapseEnv()
  }
  const touchContext = scenarioNeedsTouchContext(pickle)
  context = await browser.newContext(
    touchContext ? { hasTouch: true } : {},
  )
  page = await context.newPage()
  this.page = page
})

After(async function () {
  if (page) {
    await page.close()
    page = undefined
  }
  if (context) {
    await context.close()
    context = undefined
  }
})
