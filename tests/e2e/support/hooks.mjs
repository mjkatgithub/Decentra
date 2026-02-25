import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import { resolve } from 'node:path'
import { loadE2EEnv } from '../scripts/runtime-e2e-env.mjs'

let browser
let page

const isHeadless = process.env.HEADLESS !== 'false'
loadE2EEnv(resolve(process.cwd()))

function shouldValidateSynapseEnv(pickle) {
  if (!pickle?.steps) {
    return false
  }
  return pickle.steps.some((step) => {
    return typeof step.text === 'string' &&
      step.text.includes('I open the seeded test room')
  })
}

function validateSynapseEnv() {
  const requiredKeys = [
    'E2E_MATRIX_HOMESERVER',
    'E2E_MATRIX_USERNAME',
    'E2E_MATRIX_PASSWORD',
    'E2E_SECOND_MATRIX_USERNAME',
    'E2E_SECOND_MATRIX_PASSWORD'
  ]
  const missingKeys = requiredKeys.filter((requiredKey) => !process.env[requiredKey])
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
  page = await browser.newPage()
  this.page = page
})

After(async function () {
  if (page) await page.close()
})
