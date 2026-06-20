/**
 * Run one or more Cucumber scenarios in isolation (local debugging only).
 *
 * Not used by CI. Requires Synapse seeded + preview on BASE_URL (default :3000).
 *
 * @example
 * node tests/e2e/scripts/run-cucumber-debug-scenario.mjs --help
 * node tests/e2e/scripts/run-cucumber-debug-scenario.mjs \
 *   --name "Create space from rail appears in navigation"
 * node tests/e2e/scripts/run-cucumber-debug-scenario.mjs \
 *   --feature tests/e2e/features/chat.feature:18
 * node tests/e2e/scripts/run-cucumber-debug-scenario.mjs \
 *   --tags "@leave_room" --name "Leave seeded group room from sidebar"
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv } from './runtime-e2e-env.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
const workspaceRoot = resolve(dirname(currentFilePath), '..', '..', '..')

const HELP_TEXT = `Run selected Cucumber E2E scenarios (debug only, not CI).

Usage:
  node tests/e2e/scripts/run-cucumber-debug-scenario.mjs [options]

Options:
  -n, --name <text>       Scenario name (repeat for OR match)
  -f, --feature <path>    Feature file or file:line (repeat allowed)
  -t, --tags <expression>   Cucumber tag expression (e.g. "@smoke", "not @wip")
  -h, --help              Show this help

npm wrapper:
  npm run test:e2e:cucumber:debug -- --name "My scenario"
  npm run test:e2e:run:debug -- --name "My scenario"

Prerequisites:
  1. Synapse up + seeded (see README — E2E Credentials)
  2. App built and preview on port 3000 (test:e2e:run:debug does both)

Examples:
  --name "Create space from rail appears in navigation"
  --feature tests/e2e/features/chat.feature:18
  --name "Member presence indicator reflects standard status"
  --tags "@leave_room"
`

/**
 * @param {string[]} argv
 */
export function parseCucumberDebugArgs(argv) {
  /** @type {{ names: string[], features: string[], tags?: string, help: boolean }} */
  const parsed = {
    names: [],
    features: [],
    tags: undefined,
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '-h' || token === '--help') {
      parsed.help = true
      continue
    }
    if (token === '-n' || token === '--name') {
      const value = argv[index + 1]
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --name')
      }
      parsed.names.push(value)
      index++
      continue
    }
    if (token === '-f' || token === '--feature') {
      const value = argv[index + 1]
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --feature')
      }
      parsed.features.push(value)
      index++
      continue
    }
    if (token === '-t' || token === '--tags') {
      const value = argv[index + 1]
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --tags')
      }
      parsed.tags = value
      index++
      continue
    }
    throw new Error(`Unknown argument: ${token}\n\n${HELP_TEXT}`)
  }

  if (
    !parsed.help &&
    parsed.names.length === 0 &&
    parsed.features.length === 0 &&
    !parsed.tags
  ) {
    throw new Error(
      'Select at least one of --name, --feature, or --tags.\n\n' + HELP_TEXT,
    )
  }

  return parsed
}

/**
 * @param {{ names: string[], features: string[], tags?: string }} options
 */
export function buildCucumberDebugSpawnArgs(options) {
  const cucumberEntry = resolve(
    workspaceRoot,
    'node_modules/@cucumber/cucumber/bin/cucumber.js',
  )
  if (!existsSync(cucumberEntry)) {
    throw new Error(`Missing @cucumber/cucumber at ${cucumberEntry}`)
  }

  const args = [cucumberEntry]
  if (options.tags) {
    args.push('--tags', options.tags)
  }
  for (const scenarioName of options.names) {
    args.push('--name', scenarioName)
  }
  for (const featurePath of options.features) {
    args.push(featurePath)
  }
  return args
}

/**
 * @param {string[]} argv
 */
export function runCucumberDebugScenarios(argv) {
  const parsed = parseCucumberDebugArgs(argv)
  if (parsed.help) {
    console.log(HELP_TEXT)
    return Promise.resolve(0)
  }

  loadE2EEnv(workspaceRoot)
  const args = buildCucumberDebugSpawnArgs(parsed)

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', (error) => rejectPromise(error))
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise(0)
        return
      }
      rejectPromise(
        new Error(`cucumber-js exited with code ${exitCode ?? 1}`),
      )
    })
  })
}

const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  runCucumberDebugScenarios(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
