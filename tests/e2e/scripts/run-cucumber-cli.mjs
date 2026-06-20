import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv } from './runtime-e2e-env.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
export const workspaceRoot = resolve(
  dirname(currentFilePath),
  '..',
  '..',
  '..'
)

function resolveCucumberEntry() {
  const entry = resolve(
    workspaceRoot,
    'node_modules/@cucumber/cucumber/bin/cucumber.js'
  )
  if (!existsSync(entry)) {
    throw new Error(`Missing @cucumber/cucumber at ${entry}`)
  }
  return entry
}

/**
 * Run Cucumber via Node (no shell) so Windows does not treat `@tag` as paths.
 *
 * @param {string | undefined} tagExpression
 */
export function runCucumber(tagExpression) {
  loadE2EEnv(workspaceRoot)

  const args = [resolveCucumberEntry()]
  if (tagExpression) {
    args.push('--tags', tagExpression)
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', (error) => rejectPromise(error))
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`cucumber-js exited with code ${exitCode ?? 1}`))
    })
  })
}
