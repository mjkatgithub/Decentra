import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv, parseBoolean } from './runtime-e2e-env.mjs'

const command = process.argv[2]
const currentFilePath = fileURLToPath(import.meta.url)
const workspaceRoot = resolve(dirname(currentFilePath), '..', '..', '..')
const synapseDir = resolve(workspaceRoot, 'tests', 'e2e', 'synapse')
const dataDir = resolve(synapseDir, 'data')
const composeFile = resolve(synapseDir, 'docker-compose.yml')
const homeserverConfigPath = resolve(dataDir, 'homeserver.yaml')
const overrideStart = '# BEGIN DECENTRA_E2E_OVERRIDES'
const overrideEnd = '# END DECENTRA_E2E_OVERRIDES'

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

function ensureDirectory(directoryPath) {
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true })
  }
}

const rateLimitOverrideLines = [
  'rc_registration:',
  '  per_second: 1000',
  '  burst_count: 1000',
  'rc_login:',
  '  address:',
  '    per_second: 1000',
  '    burst_count: 1000',
  '  account:',
  '    per_second: 1000',
  '    burst_count: 1000',
  '  failed_attempts:',
  '    per_second: 1000',
  '    burst_count: 1000',
  'rc_message:',
  '  per_second: 1000',
  '  burst_count: 1000'
]

function buildDefaultOverrideBlock() {
  return [
    overrideStart,
    'enable_registration: true',
    'enable_registration_without_verification: true',
    'registration_shared_secret: "decentra-e2e-shared-secret"',
    'allow_public_rooms_without_auth: true',
    'allow_public_rooms_over_federation: false',
    ...rateLimitOverrideLines,
    overrideEnd
  ].join('\n')
}

function buildEmail3pidOverrideBlock() {
  return [
    overrideStart,
    'enable_registration: true',
    'enable_registration_without_verification: false',
    'registrations_require_3pid:',
    '  - email',
    'registration_shared_secret: "decentra-e2e-shared-secret"',
    'allow_public_rooms_without_auth: true',
    'allow_public_rooms_over_federation: false',
    'email:',
    '  smtp_host: mailhog',
    '  smtp_port: 1025',
    '  notif_from: "Decentra E2E <synapse@localhost>"',
    '  enable_notifs: false',
    ...rateLimitOverrideLines,
    overrideEnd
  ].join('\n')
}

function ensureSynapseConfigOverrides() {
  if (!existsSync(homeserverConfigPath)) {
    throw new Error(`Missing Synapse config at ${homeserverConfigPath}`)
  }
  const currentConfig = readFileSync(homeserverConfigPath, 'utf8')
  const useEmail3pid = parseBoolean(
    process.env.DECENTRA_E2E_SIGNUP_EMAIL
  )
  const overrideBlock = useEmail3pid
    ? buildEmail3pidOverrideBlock()
    : buildDefaultOverrideBlock()
  const overrideRegex = new RegExp(
    `${overrideStart}[\\s\\S]*${overrideEnd}`,
    'm'
  )
  const baseConfig = currentConfig.replace(overrideRegex, '').trimEnd()
  writeFileSync(
    homeserverConfigPath,
    `${baseConfig}\n\n${overrideBlock}\n`,
    'utf8'
  )
  if (useEmail3pid) {
    console.log(
      'Synapse E2E: email+3pid overrides (DECENTRA_E2E_SIGNUP_EMAIL=1)'
    )
  }
}

async function waitForSynapse() {
  const endpoint = 'http://127.0.0.1:8008/_matrix/client/versions'
  const timeoutMs = 120000
  const pollMs = 2000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(endpoint)
      if (response.ok) {
        console.log('Synapse is ready at http://127.0.0.1:8008')
        return
      }
    } catch {
      // Keep polling.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs))
  }
  throw new Error('Synapse startup timed out after 120 seconds')
}

async function ensureConfigGenerated() {
  ensureDirectory(dataDir)
  if (existsSync(homeserverConfigPath)) {
    ensureSynapseConfigOverrides()
    return
  }

  await runCommand('docker', [
    'run',
    '--rm',
    '-e',
    'SYNAPSE_SERVER_NAME=localhost',
    '-e',
    'SYNAPSE_REPORT_STATS=no',
    '-v',
    `${dataDir}:/data`,
    'matrixdotorg/synapse:latest',
    'generate'
  ])
  ensureSynapseConfigOverrides()
}

async function main() {
  if (!command || !['up', 'down', 'logs', 'wait'].includes(command)) {
    console.error('Usage: node tests/e2e/scripts/runtime-manage-synapse.mjs <up|down|logs|wait>')
    process.exit(1)
  }
  if (!existsSync(composeFile)) {
    throw new Error(`Missing compose file at ${composeFile}`)
  }

  loadE2EEnv(workspaceRoot)

  await runCommand('docker', ['--version'])

  if (command === 'up') {
    await ensureConfigGenerated()
    await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d'])
    await waitForSynapse()
    return
  }
  if (command === 'down') {
    await runCommand('docker', ['compose', '-f', composeFile, 'down'])
    return
  }
  if (command === 'logs') {
    await runCommand('docker', [
      'compose', '-f', composeFile, 'logs', '--tail', '200', 'synapse'
    ])
    return
  }

  await waitForSynapse()
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
