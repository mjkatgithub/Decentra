import { describe, expect, it, vi } from 'vitest'
import { EventType } from 'matrix-js-sdk'
import {
  isRoomListedInDirectAccountData,
  leaveRoom,
  removeDirectAccountData,
} from '~/composables/matrix/roomsOrDirectory'

describe('removeDirectAccountData', () => {
  it('removes room id from m.direct map', async () => {
    const setAccountData = vi.fn(async () => undefined)
    const matrixClient = {
      getAccountData: vi.fn((type: string) => {
        if (type === EventType.Direct) {
          return {
            getContent: () => ({
              '@bob:example.org': ['!dm:example.org', '!other:example.org'],
              '@carol:example.org': ['!dm:example.org'],
            }),
          }
        }
        return undefined
      }),
      setAccountData,
    }

    await removeDirectAccountData(matrixClient as never, '!dm:example.org')

    expect(setAccountData).toHaveBeenCalledWith(EventType.Direct, {
      '@bob:example.org': ['!other:example.org'],
    })
  })

  it('skips setAccountData when room is not listed', async () => {
    const setAccountData = vi.fn(async () => undefined)
    const matrixClient = {
      getAccountData: vi.fn(() => ({
        getContent: () => ({
          '@bob:example.org': ['!other:example.org'],
        }),
      })),
      setAccountData,
    }

    await removeDirectAccountData(matrixClient as never, '!missing:example.org')

    expect(setAccountData).not.toHaveBeenCalled()
  })
})

describe('isRoomListedInDirectAccountData', () => {
  it('returns true when room id is present', () => {
    const matrixClient = {
      getAccountData: vi.fn(() => ({
        getContent: () => ({
          '@bob:example.org': ['!dm:example.org'],
        }),
      })),
    }

    expect(
      isRoomListedInDirectAccountData(
        matrixClient as never,
        '!dm:example.org',
      ),
    ).toBe(true)
  })
})

describe('leaveRoom', () => {
  it('calls client.leave with room id', async () => {
    const leave = vi.fn(async () => undefined)
    const forget = vi.fn(async () => undefined)
    const matrixClient = {
      getAccountData: vi.fn(() => undefined),
      leave,
      forget,
      setAccountData: vi.fn(),
    }

    await leaveRoom(matrixClient as never, '!room:example.org')

    expect(leave).toHaveBeenCalledWith('!room:example.org')
    expect(forget).toHaveBeenCalledWith('!room:example.org')
  })

  it('prunes m.direct after a successful leave', async () => {
    const leave = vi.fn(async () => undefined)
    const forget = vi.fn(async () => undefined)
    const setAccountData = vi.fn(async () => undefined)
    const matrixClient = {
      getAccountData: vi.fn(() => ({
        getContent: () => ({
          '@bob:example.org': ['!dm:example.org'],
        }),
      })),
      leave,
      forget,
      setAccountData,
    }

    await leaveRoom(matrixClient as never, '!dm:example.org')

    expect(leave).toHaveBeenCalledWith('!dm:example.org')
    expect(setAccountData).toHaveBeenCalledWith(EventType.Direct, {})
    expect(forget).toHaveBeenCalledWith('!dm:example.org')
  })

  it('maps forbidden errors to user-visible messages', async () => {
    const matrixClient = {
      getAccountData: vi.fn(() => undefined),
      leave: vi.fn(async () => {
        throw {
          errcode: 'M_FORBIDDEN',
          error: 'You are not allowed to leave this room',
        }
      }),
      setAccountData: vi.fn(),
    }

    await expect(
      leaveRoom(matrixClient as never, '!room:example.org'),
    ).rejects.toThrow('You are not allowed to leave this room')
  })
})
