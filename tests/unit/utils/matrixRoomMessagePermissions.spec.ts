import { describe, it } from 'vitest'
import {
  canUserSendRoomMessage,
  getRequiredPowerForRoomMessage,
} from '~/utils/matrixRoomMessagePermissions'

describe('matrixRoomMessagePermissions', () => {
  it('reads required power for m.room.message from events map', () => {
    const required = getRequiredPowerForRoomMessage({
      events: { 'm.room.message': 10 },
      events_default: 0,
    })
    required.should.equal(10)
  })

  it('falls back to events_default when message event is unset', () => {
    const required = getRequiredPowerForRoomMessage({
      events_default: 25,
    })
    required.should.equal(25)
  })

  it('allows send when user level meets requirement', () => {
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({
              users: { '@alice:example.org': 50 },
              events: { 'm.room.message': 10 },
              events_default: 0,
            }),
          }],
        },
      }),
    }

    const allowed = canUserSendRoomMessage(
      matrixClient as any,
      '!room:example.org',
      '@alice:example.org',
    )
    allowed.should.equal(true)
  })
})
