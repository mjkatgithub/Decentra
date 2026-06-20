import { describe, expect, it } from 'vitest'
import { getRoomCreatorUserId } from '~/utils/matrixPowerLevels'

describe('getRoomCreatorUserId', () => {
  it('uses m.room.create sender when creator field is absent', () => {
    const matrixClient = {
      getRoom: () => ({
        getCreator: () => '@founder:matrix.org',
      }),
    } as never
    expect(getRoomCreatorUserId(matrixClient, '!room:matrix.org')).toBe(
      '@founder:matrix.org',
    )
  })
})
