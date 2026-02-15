import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let browser
let page

const isHeadless = process.env.HEADLESS !== 'false'
loadE2EEnv()

function loadE2EEnv() {
  const envFileNames = [
    'tests/e2e/.env.e2e.local',
    'tests/e2e/.env.e2e',
    '.env.e2e.local',
    '.env.e2e'
  ]

  for (const envFileName of envFileNames) {
    const absolutePath = resolve(process.cwd(), envFileName)
    if (!existsSync(absolutePath)) {
      continue
    }
    const envContent = readFileSync(absolutePath, 'utf8')
    const envLines = envContent.split(/\r?\n/)

    for (const envLine of envLines) {
      const trimmedLine = envLine.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }
      const separatorIndex = trimmedLine.indexOf('=')
      if (separatorIndex <= 0) {
        continue
      }
      const variableName = trimmedLine.slice(0, separatorIndex).trim()
      const variableValue = trimmedLine.slice(separatorIndex + 1).trim()
      if (!process.env[variableName]) {
        process.env[variableName] = variableValue
      }
    }
    break
  }
}

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
