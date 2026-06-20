import { describe, it } from 'vitest'
import {
  persistSpaceChildOrder,
  sendSpaceChildState,
} from '~/composables/matrix/spaceStateHelpers'
import { SPACE_CHILD_EVENT } from '~/utils/spaceRoomCategories'

describe('spaceStateHelpers', () => {
  it('persistSpaceChildOrder sends one state event per child', async () => {
    const sendCalls: unknown[][] = []
    const matrixClient = {
      getRoom: () => ({
        currentState: {
          getStateEvents: () => [],
        },
      }),
      sendStateEvent: async (...args: unknown[]) => {
        sendCalls.push(args)
      },
    }
    await persistSpaceChildOrder(
      matrixClient as never,
      '!parent:example.org',
      ['!a:example.org', '!b:example.org'],
    )
    sendCalls.length.should.equal(2)
    sendCalls[0]![0].should.equal('!parent:example.org')
    sendCalls[0]![1].should.equal(SPACE_CHILD_EVENT)
    sendCalls[0]![3].should.equal('!a:example.org')
  })

  it('sendSpaceChildState passes content and state key', async () => {
    const calls: unknown[][] = []
    const matrixClient = {
      sendStateEvent: async (...args: unknown[]) => {
        calls.push(args)
      },
    }
    await sendSpaceChildState(matrixClient as never, {
      parentSpaceId: '!p:example.org',
      childRoomId: '!c:example.org',
      via: ['example.org'],
      order: '0001',
    })
    calls.length.should.equal(1)
    calls[0]![2].should.deep.equal({
      via: ['example.org'],
      order: '0001',
    })
    calls[0]![3].should.equal('!c:example.org')
  })
})
