import { describe, expect, it } from 'vitest'
import {
  buildCucumberDebugSpawnArgs,
  parseCucumberDebugArgs,
} from '../../../tests/e2e/scripts/run-cucumber-debug-scenario.mjs'

describe('run-cucumber-debug-scenario', () => {
  it('parses name, feature, and tags', () => {
    const parsed = parseCucumberDebugArgs([
      '--name',
      'Create space from rail appears in navigation',
      '--feature',
      'tests/e2e/features/chat.feature:18',
      '--tags',
      'not @wip',
    ])
    expect(parsed.names).toEqual([
      'Create space from rail appears in navigation',
    ])
    expect(parsed.features).toEqual(['tests/e2e/features/chat.feature:18'])
    expect(parsed.tags).toBe('not @wip')
  })

  it('requires at least one filter unless --help', () => {
    expect(() => parseCucumberDebugArgs([])).toThrow(
      /Select at least one/,
    )
    expect(parseCucumberDebugArgs(['--help']).help).toBe(true)
  })

  it('builds cucumber spawn args', () => {
    const args = buildCucumberDebugSpawnArgs({
      names: ['Member presence indicator reflects standard status'],
      features: [],
      tags: undefined,
    })
    expect(args).toContain('--name')
    expect(args).toContain(
      'Member presence indicator reflects standard status',
    )
  })
})
