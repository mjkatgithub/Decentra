import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import { resolve } from 'node:path'
import { loadE2EEnv } from '../scripts/runtime-e2e-env.mjs'

let browser
let page

const isHeadless = process.env.HEADLESS !== 'false'
loadE2EEnv(resolve(process.cwd()))

BeforeAll(async function () {
  browser = await chromium.launch({ headless: isHeadless })
})

AfterAll(async function () {
  if (browser) await browser.close()
})

Before(async function () {
  page = await browser.newPage()
  this.page = page
})

After(async function () {
  if (page) await page.close()
})
