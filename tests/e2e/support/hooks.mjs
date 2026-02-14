import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'

let browser
let page

const isHeadless = process.env.HEADLESS !== 'false'

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
