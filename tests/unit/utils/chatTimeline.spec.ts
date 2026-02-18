import { describe, it } from 'vitest'
import {
  buildUndecryptableMessageText,
  getMessageBody,
  isUndecryptableEvent
} from '~/utils/chatTimeline'

describe('chatTimeline helpers', () => {
  it('detects undecryptable encrypted events', () => {
    const undecryptable = isUndecryptableEvent({
      getType: () => 'm.room.encrypted',
      getWireType: () => 'm.room.encrypted'
    })
    undecryptable.should.equal(true)
  })

  it('treats decrypted m.room.message as readable', () => {
    const undecryptable = isUndecryptableEvent({
      getType: () => 'm.room.message',
      getWireType: () => 'm.room.encrypted',
      isDecryptionFailure: () => false
    })
    undecryptable.should.equal(false)
  })

  it('returns readable fallback for undecryptable messages', () => {
    const text = buildUndecryptableMessageText('Alice')
    text.should.include('Alice')
    text.should.include('could not be decrypted')
  })

  it('returns message body for decrypted events', () => {
    const body = getMessageBody(
      {
        getContent: () => ({ body: 'hello world' })
      },
      'Alice',
      false
    )
    body.should.equal('hello world')
  })
})
