import { describe, it } from 'vitest'
import {
  getPinnedEventIds,
  pinRoomEvent,
  unpinRoomEvent,
} from '~/utils/matrixRoomPinnedEvents'

describe('matrixRoomPinnedEvents', () => {
  it('reads pinned ids from room state', () => {
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({
              pinned: ['$a', '$b', '$a'],
            }),
          }],
        },
      }),
    }

    const ids = getPinnedEventIds(
      matrixClient as never,
      '!room:example.org',
    )
    ids.should.deep.equal(['$a', '$b'])
  })

  it('pinRoomEvent appends id and sends state', async () => {
    const sendCalls: unknown[][] = []
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({ pinned: ['$existing'] }),
          }],
        },
      }),
      sendStateEvent: async (...args: unknown[]) => {
        sendCalls.push(args)
      },
    }

    await pinRoomEvent(
      matrixClient as never,
      '!room:example.org',
      '$new',
    )

    sendCalls.length.should.equal(1)
    sendCalls[0]![2].should.deep.equal({
      pinned: ['$existing', '$new'],
    })
  })

  it('pinRoomEvent skips duplicate ids', async () => {
    let sendCount = 0
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({ pinned: ['$existing'] }),
          }],
        },
      }),
      sendStateEvent: async () => {
        sendCount += 1
      },
    }

    await pinRoomEvent(
      matrixClient as never,
      '!room:example.org',
      '$existing',
    )
    sendCount.should.equal(0)
  })

  it('unpinRoomEvent removes id from state', async () => {
    const sendCalls: unknown[][] = []
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [{
            getContent: () => ({
              pinned: ['$keep', '$remove'],
            }),
          }],
        },
      }),
      sendStateEvent: async (...args: unknown[]) => {
        sendCalls.push(args)
      },
    }

    await unpinRoomEvent(
      matrixClient as never,
      '!room:example.org',
      '$remove',
    )

    sendCalls[0]![2].should.deep.equal({ pinned: ['$keep'] })
  })
})
