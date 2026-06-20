import { describe, expect, it } from 'vitest'
import { parseMatrixInviteTargets } from '~/utils/parseMatrixInviteTargets'

describe('parseMatrixInviteTargets', () => {
  it('parses full Matrix IDs and deduplicates', () => {
    const result = parseMatrixInviteTargets(
      '@alice:example.org\n@bob:example.org, @alice:example.org',
      'example.org',
    )
    expect(result).toEqual([
      '@alice:example.org',
      '@bob:example.org',
    ])
  })

  it('appends homeserver domain for local names', () => {
    const result = parseMatrixInviteTargets(
      'carol, @dave',
      'example.org',
    )
    expect(result).toEqual([
      '@carol:example.org',
      '@dave:example.org',
    ])
  })

  it('skips invalid tokens without domain', () => {
    const result = parseMatrixInviteTargets('notanid', '')
    expect(result).toEqual([])
  })
})
