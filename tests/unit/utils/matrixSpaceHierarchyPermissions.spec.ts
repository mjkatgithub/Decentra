import { describe, it } from 'vitest'
import {
  canUserSendSpaceChildState,
  getRequiredPowerForSpaceChild,
  getUserPowerLevelInRoomFromState,
} from '~/utils/matrixSpaceHierarchyPermissions'

describe('matrixSpaceHierarchyPermissions', () => {
  it('uses events m.space.child override when present', () => {
    const need = getRequiredPowerForSpaceChild({
      events: { 'm.space.child': 100 },
      state_default: 50,
    })
    need.should.equal(100)
  })

  it('falls back to state_default', () => {
    const need = getRequiredPowerForSpaceChild({
      state_default: 50,
    })
    need.should.equal(50)
  })

  it('reads user level from users map', () => {
    const pl = getUserPowerLevelInRoomFromState(
      {
        users: { '@a:example.org': 100 },
        users_default: 0,
      },
      '@a:example.org',
    )
    pl.should.equal(100)
  })

  it('canUserSendSpaceChildState compares levels', () => {
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => ({
            getContent: () => ({
              users: { '@me:example.org': 100 },
              users_default: 0,
              state_default: 50,
              events: { 'm.space.child': 100 },
            }),
          }),
        },
      }),
    }
    canUserSendSpaceChildState(
      matrixClient as never,
      '!s:example.org',
      '@me:example.org',
    ).should.equal(true)

    canUserSendSpaceChildState(
      matrixClient as never,
      '!s:example.org',
      '@other:example.org',
    ).should.equal(false)
  })
})
