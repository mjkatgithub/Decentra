import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function parseBoolean(value) {
  if (!value) {
    return false
  }
  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue === '1' ||
    normalizedValue === 'true' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'on'
}

export function loadE2EEnv(workspaceRoot) {
  const envFileNames = [
    'tests/e2e/.env.e2e.generated',
    'tests/e2e/.env.e2e.local',
    'tests/e2e/.env.e2e',
    '.env.e2e.local',
    '.env.e2e'
  ]

  for (const envFileName of envFileNames) {
    const absolutePath = resolve(workspaceRoot, envFileName)
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
      process.env[variableName] = variableValue
    }
  }

  if (parseBoolean(process.env.E2E_USE_LOCAL_SYNAPSE)) {
    process.env.E2E_MATRIX_HOMESERVER = process.env.E2E_LOCAL_HOMESERVER ||
      'http://127.0.0.1:8008'
  }
}
