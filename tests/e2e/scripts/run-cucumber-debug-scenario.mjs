import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv } from './runtime-e2e-env.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
const workspaceRoot = resolve(dirname(currentFilePath), '..', '..', '..')

loadE2EEnv(workspaceRoot)

const cucumberEntry = resolve(
  workspaceRoot,
  'node_modules/@cucumber/cucumber/bin/cucumber.js',
)
if (!existsSync(cucumberEntry)) {
  throw new Error(`Missing @cucumber/cucumber at ${cucumberEntry}`)
}

const args = [
  cucumberEntry,
  '--name',
  'Create space from rail appears in navigation',
  '--name',
  'Member presence indicator reflects standard status',
]

const child = spawn(process.execPath, args, {
  cwd: workspaceRoot,
  stdio: 'inherit',
  env: process.env,
})

child.on('close', (exitCode) => {
  process.exit(exitCode ?? 1)
})
