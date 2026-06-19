import { describe, expect, it } from 'vitest'
import {
  normalizePresence,
  resolveRawMemberPresence,
} from '~/composables/chat/chatPageRoomHelpers'
import { writeStoredMatrixPresence } from '~/utils/matrixPresencePreference'

describe('member presence helpers', () => {
  it('maps Matrix presence values to member status', () => {
    normalizePresence('online').should.equal('online')
    normalizePresence('unavailable').should.equal('away')
    normalizePresence('offline').should.equal('offline')
    normalizePresence('org.matrix.msc3026.busy').should.equal('busy')
    normalizePresence(undefined).should.equal('unknown')
  })

  it('prefers own user presence from the matrix client', () => {
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getUser: (userId: string) => {
        if (userId === '@alice:example.org') {
          return { presence: 'unavailable' }
        }
        return null
      },
    }
    const rawPresence = resolveRawMemberPresence(
      {
        userId: '@alice:example.org',
        user: { presence: 'online' },
        presence: 'online',
      },
      matrixClient,
    )
    expect(rawPresence).toBe('unavailable')
  })

  it('prefers stored presence for the signed-in user', () => {
    writeStoredMatrixPresence('unavailable')
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getUser: () => ({ presence: 'online' }),
    }
    const rawPresence = resolveRawMemberPresence(
      {
        userId: '@alice:example.org',
        user: { presence: 'online' },
      },
      matrixClient,
    )
    expect(rawPresence).toBe('unavailable')
  })

  it('falls back to member user presence for other members', () => {
    const matrixClient = {
      getUserId: () => '@alice:example.org',
      getUser: () => ({ presence: 'online' }),
    }
    const rawPresence = resolveRawMemberPresence(
      {
        userId: '@bob:example.org',
        user: { presence: 'offline' },
        presence: 'online',
      },
      matrixClient,
    )
    rawPresence.should.equal('offline')
  })

  it('falls back to member presence when user presence is missing', () => {
    const rawPresence = resolveRawMemberPresence(
      {
        userId: '@bob:example.org',
        presence: 'unavailable',
      },
      null,
    )
    rawPresence.should.equal('unavailable')
  })
})
