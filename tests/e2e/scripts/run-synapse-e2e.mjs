import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv } from './runtime-e2e-env.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
const workspaceRoot = resolve(dirname(currentFilePath), '..', '..', '..')
const generatedEnvPath = resolve(workspaceRoot, 'tests/e2e/.env.e2e.generated')

function runCommand(binary, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const commandProcess = spawn(binary, args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
    commandProcess.on('error', (error) => rejectPromise(error))
    commandProcess.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`${binary} exited with code ${exitCode ?? 1}`))
    })
  })
}

async function main() {
  let testFailed = false
  await runCommand('node', ['tests/e2e/scripts/runtime-manage-synapse.mjs', 'up'])
  await runCommand('node', ['tests/e2e/scripts/runtime-seed-synapse.mjs'])
  loadE2EEnv(workspaceRoot)
  if (!existsSync(generatedEnvPath) || !process.env.E2E_MATRIX_USERNAME) {
    throw new Error(
      'Synapse seed did not write E2E credentials to '
      + 'tests/e2e/.env.e2e.generated'
    )
  }

  try {
    await runCommand('npm', ['run', 'test:e2e:run'])
  } catch (error) {
    testFailed = true
    console.error(
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    try {
      if (testFailed) {
        await runCommand('node', ['tests/e2e/scripts/runtime-manage-synapse.mjs', 'logs'])
      }
    } finally {
      await runCommand('node', ['tests/e2e/scripts/runtime-manage-synapse.mjs', 'down'])
    }
  }

  if (testFailed) {
    process.exit(1)
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error))
  try {
    await runCommand('node', ['tests/e2e/scripts/runtime-manage-synapse.mjs', 'logs'])
  } catch {
    // Ignore log failures during fallback cleanup.
  }
  try {
    await runCommand('node', ['tests/e2e/scripts/runtime-manage-synapse.mjs', 'down'])
  } catch {
    // Ignore cleanup failures here.
  }
  process.exit(1)
})
