import { describe, it } from 'vitest'
import {
  canUserPinEvents,
  getRequiredPowerForPinnedEvents,
} from '~/utils/matrixRoomPinnedEventsPermissions'

describe('matrixRoomPinnedEventsPermissions', () => {
  it('reads required power from events map', () => {
    const required = getRequiredPowerForPinnedEvents({
      events: { 'm.room.pinned_events': 10 },
      state_default: 50,
    })
    required.should.equal(10)
  })

  it('falls back to state_default when pinned event is unset', () => {
    const required = getRequiredPowerForPinnedEvents({
      state_default: 25,
    })
    required.should.equal(25)
  })

  it('allows pin when user level meets requirement', () => {
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({
              users: { '@alice:example.org': 50 },
              events: { 'm.room.pinned_events': 10 },
              state_default: 50,
            }),
          }],
        },
      }),
    }

    const allowed = canUserPinEvents(
      matrixClient as never,
      '!room:example.org',
      '@alice:example.org',
    )
    allowed.should.equal(true)
  })
})
