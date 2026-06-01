import { describe, it } from 'vitest'
import {
  buildUndecryptableMessageText,
  getMessageBody,
  getRedactedEventIds,
  isRedactedMessageEvent,
  isUndecryptableEvent,
} from '~/utils/chatTimeline'

describe('chatTimeline event helpers', () => {
  it('detects undecryptable encrypted events', () => {
    const undecryptable = isUndecryptableEvent({
      getType: () => 'm.room.encrypted',
      getWireType: () => 'm.room.encrypted',
    })
    undecryptable.should.equal(true)
  })

  it('treats decrypted m.room.message as readable', () => {
    const undecryptable = isUndecryptableEvent({
      getType: () => 'm.room.message',
      getWireType: () => 'm.room.encrypted',
      isDecryptionFailure: () => false,
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
        getContent: () => ({ body: 'hello world' }),
      },
      'Alice',
      false,
    )
    body.should.equal('hello world')
  })

  it('prefers m.new_content body over outer placeholder body', () => {
    const body = getMessageBody(
      {
        getContent: () => ({
          body: '* edited message',
          msgtype: 'm.text',
          'm.new_content': {
            msgtype: 'm.text',
            body: 'edited message',
          },
          'm.relates_to': {
            rel_type: 'm.replace',
            event_id: 'evt_original',
          },
        }),
      },
      'Alice',
      false,
    )
    body.should.equal('edited message')
  })

  it('returns tombstone text for redacted messages', () => {
    const body = getMessageBody(
      { getContent: () => ({}) },
      'Alice',
      true,
      { redactedMessage: true, deletedMessageText: 'Message deleted' },
    )
    body.should.equal('Message deleted')
    body.should.not.include('could not be decrypted')
  })

  it('collects redacted event ids from redaction events', () => {
    const ids = getRedactedEventIds([
      {
        getType: () => 'm.room.redaction',
        getRedacts: () => 'msg_target',
      },
    ])
    ids.has('msg_target').should.equal(true)
  })

  it('detects redacted messages via event id set or SDK flag', () => {
    const redactedIds = new Set(['msg_a'])
    isRedactedMessageEvent(
      { getId: () => 'msg_a' },
      redactedIds,
    ).should.equal(true)
    isRedactedMessageEvent(
      { getId: () => 'msg_b', isRedacted: () => true },
      new Set(),
    ).should.equal(true)
  })
})
