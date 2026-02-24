import { describe, it } from 'vitest'
import {
  buildUndecryptableMessageText,
  getMessageBody,
  isUndecryptableEvent,
  mapTimelineEventsToMessages
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

  it('maps m.image messages with mxcUrl and isEncrypted', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_img_1',
            getContent: () => ({
              body: 'image.png',
              msgtype: 'm.image',
              url: 'mxc://example.org/123',
              info: { mimetype: 'image/png' }
            }),
            isDecryptionFailure: () => false
          }
        ]
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@bob:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: (mxc: string) => `http://server/thumb/${mxc.split('//')[1]}`,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    const media = messages[0]!.media!
    media.url.should.equal('http://server/thumb/example.org/123')
    media.mxcUrl.should.equal('mxc://example.org/123')
    media.mimetype!.should.equal('image/png')
  })

  it('keeps image url empty for gif media to force blob fetch', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_img_gif',
            getContent: () => ({
              body: 'animated.gif',
              msgtype: 'm.image',
              url: 'mxc://example.org/gif123',
              info: { mimetype: 'image/gif' }
            }),
            isDecryptionFailure: () => false
          }
        ]
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@bob:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => 'http://server/thumb/gif123',
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    messages[0]!.media!.url.should.equal('')
    messages[0]!.media!.mxcUrl.should.equal('mxc://example.org/gif123')
  })

  it('maps encrypted image with encryption metadata', () => {
    const fileInfo = {
      key: {
        k: 'secret',
        kty: 'oct',
        alg: 'A256CTR',
        key_ops: ['encrypt', 'decrypt'],
        ext: true
      },
      iv: 'Zm9vYmFy',
      hashes: { sha256: 'abc' },
      v: 'v2',
      url: 'mxc://example.org/encrypted-image'
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_img_enc',
            getContent: () => ({
              body: 'secret.png',
              msgtype: 'm.image',
              file: fileInfo,
              info: { mimetype: 'image/png' }
            }),
            isDecryptionFailure: () => false
          }
        ]
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@bob:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => 'http://server/thumb/enc',
      buildNoticeText: () => ''
    })

    const media = messages[0]!.media!
    media.url.should.equal('')
    media.isEncrypted.should.equal(true)
    media.encryptionInfo!.url.should.equal('mxc://example.org/encrypted-image')
  })

  it('maps reply metadata from m.relates_to.m.in_reply_to', () => {
    const originalEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_original',
      getContent: () => ({
        body: 'Original text',
        msgtype: 'm.text'
      }),
      isDecryptionFailure: () => false
    }
    const replyEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_reply',
      getContent: () => ({
        body: 'Reply text',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: 'evt_original'
          }
        }
      }),
      isDecryptionFailure: () => false
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [originalEvent, replyEvent]
      }),
      getMembers: () => [],
      getMember: (userId: string) => {
        if (userId === '@alice:example.org') {
          return { name: 'Alice' }
        }
        if (userId === '@bob:example.org') {
          return { name: 'Bob' }
        }
        return undefined
      },
      hasUserReadEvent: () => false
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(2)
    messages[1]!.replyTo!.eventId.should.equal('evt_original')
    messages[1]!.replyTo!.senderName.should.equal('Alice')
    messages[1]!.replyTo!.body.should.equal('Original text')
  })

  it('maps fallback reply metadata when original event is missing', () => {
    const replyEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_reply_missing',
      getContent: () => ({
        body: 'Reply text',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: 'evt_not_found'
          }
        }
      }),
      isDecryptionFailure: () => false
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [replyEvent]
      }),
      getMembers: () => [],
      getMember: (userId: string) => ({ name: userId }),
      hasUserReadEvent: () => false
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    messages[0]!.replyTo!.eventId.should.equal('evt_not_found')
    messages[0]!.replyTo!.senderName.should.equal('Unknown user')
    messages[0]!.replyTo!.body.should.equal('Original message unavailable.')
  })
})
