import { describe, expect, it } from 'vitest'
import {
  buildThreadRelatesTo,
  getThreadRootEventId,
  isThreadReplyContent,
} from '~/utils/matrixThreadRelations'

describe('matrixThreadRelations', () => {
  it('returns thread root id when rel_type is m.thread', () => {
    expect(
      getThreadRootEventId({
        body: 'hi',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: '$root123',
        },
      }),
    ).to.equal('$root123')
  })

  it('returns undefined when not a thread relation', () => {
    expect(getThreadRootEventId({ body: 'hi' })).to.be.undefined
    expect(
      getThreadRootEventId({
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: '$x',
        },
      }),
    ).to.be.undefined
  })

  it('isThreadReplyContent mirrors getThreadRootEventId', () => {
    expect(
      isThreadReplyContent({
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: '$r',
        },
      }),
    ).to.equal(true)
  })

  it('buildThreadRelatesTo includes optional in_reply_to', () => {
    expect(
      buildThreadRelatesTo({
        threadRootEventId: '$root',
        inReplyToEventId: '$prev',
      }),
    ).to.deep.equal({
      rel_type: 'm.thread',
      event_id: '$root',
      'm.in_reply_to': {
        event_id: '$prev',
      },
    })
  })

  it('buildThreadRelatesTo omits in_reply_to when absent', () => {
    expect(buildThreadRelatesTo({ threadRootEventId: '$root' })).to.deep.equal({
      rel_type: 'm.thread',
      event_id: '$root',
    })
  })
})
