import { describe, it } from 'vitest'
import {
  buildReactionSummaryByEventId,
  buildRoomThreadNavEntries,
  buildThreadSummariesByRoot,
  buildUndecryptableMessageText,
  getMessageBody,
  getRedactedEventIds,
  isRedactedMessageEvent,
  isUndecryptableEvent,
  mapTimelineEventsToMessages,
  resolvePreservedTimelineWindow,
  resolveTimelineWindowSelection,
} from '~/utils/chatTimeline'

const buildDeletedMessageText = () => 'Message deleted'

describe('chatTimeline mapping', () => {
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
      buildDeletedMessageText,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    const media = messages[0]!.media!
    media.url.should.equal('http://server/thumb/example.org/123')
    media.mxcUrl.should.equal('mxc://example.org/123')
    media.mimetype!.should.equal('image/png')
  })

  it('maps m.audio messages with mxcUrl and duration', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_audio_1',
            getContent: () => ({
              body: 'voice.webm',
              msgtype: 'm.audio',
              url: 'mxc://example.org/audio123',
              info: { mimetype: 'audio/webm', duration: 4200, size: 100 }
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
      getMediaUrl: (mxc: string) => `http://server/media/${mxc.split('//')[1]}`,
      buildDeletedMessageText,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    const media = messages[0]!.media!
    media.url.should.equal('')
    media.mxcUrl.should.equal('mxc://example.org/audio123')
    media.mimetype!.should.equal('audio/webm')
    media.info?.duration!.should.equal(4200)
  })

  it('maps m.video messages with poster and playback fields', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_video_1',
            getContent: () => ({
              body: 'clip.mp4',
              msgtype: 'm.video',
              url: 'mxc://example.org/video',
              info: {
                mimetype: 'video/mp4',
                duration: 8000,
                thumbnail_url: 'mxc://example.org/thumb',
                thumbnail_info: { mimetype: 'image/jpeg' },
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@bob:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: (mxc: string) => `http://server/${mxc.split('//')[1]}`,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(1)
    const media = messages[0]!.media!
    media.mxcUrl.should.equal('mxc://example.org/thumb')
    media.playbackMxcUrl!.should.equal('mxc://example.org/video')
    ;(media.playbackUrl === undefined).should.equal(true)
    media.info!.duration!.should.equal(8000)
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
      buildDeletedMessageText,
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
      buildDeletedMessageText,
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
      buildDeletedMessageText,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(2)
    messages[1]!.replyTo!.eventId.should.equal('evt_original')
    messages[1]!.replyTo!.senderName.should.equal('Alice')
    messages[1]!.replyTo!.body.should.equal('Original text')
    messages[1]!.replyTo!.msgtype!.should.equal('m.text')
  })

  it('maps reply metadata with image media for m.image target', () => {
    const imageEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_image',
      getContent: () => ({
        body: 'photo.png',
        msgtype: 'm.image',
        url: 'mxc://example.org/image',
        info: { mimetype: 'image/png', w: 100, h: 80 },
      }),
      isDecryptionFailure: () => false,
    }
    const replyEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_reply_image',
      getContent: () => ({
        body: 'Nice shot',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': { event_id: 'evt_image' },
        },
      }),
      isDecryptionFailure: () => false,
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [imageEvent, replyEvent],
      }),
      getMembers: () => [],
      getMember: (userId: string) => {
        if (userId === '@alice:example.org') {
          return { name: 'Alice' }
        }
        return { name: 'Bob' }
      },
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => 'http://server/image',
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    const replyMeta = messages[1]!.replyTo!
    replyMeta.msgtype!.should.equal('m.image')
    replyMeta.media!.mxcUrl.should.equal('mxc://example.org/image')
    replyMeta.media!.url.should.equal('http://server/image')
  })

  it('maps reply metadata with video msgtype for m.video target', () => {
    const videoEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_video',
      getContent: () => ({
        body: 'clip.mp4',
        msgtype: 'm.video',
        url: 'mxc://example.org/video',
        info: {
          mimetype: 'video/mp4',
          thumbnail_url: 'mxc://example.org/thumb',
          thumbnail_info: { mimetype: 'image/png' },
        },
      }),
      isDecryptionFailure: () => false,
    }
    const replyEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_reply_video',
      getContent: () => ({
        body: 'Cool clip',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': { event_id: 'evt_video' },
        },
      }),
      isDecryptionFailure: () => false,
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [videoEvent, replyEvent],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => 'http://server/thumb',
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    const replyMeta = messages[1]!.replyTo!
    replyMeta.msgtype!.should.equal('m.video')
    replyMeta.media!.mxcUrl.should.equal('mxc://example.org/thumb')
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
      buildDeletedMessageText,
      buildNoticeText: () => ''
    })

    messages.length.should.equal(1)
    messages[0]!.replyTo!.eventId.should.equal('evt_not_found')
    messages[0]!.replyTo!.senderName.should.equal('Unknown user')
    messages[0]!.replyTo!.body.should.equal('Original message unavailable.')
  })

  it('maps redacted encrypted message to deleted tombstone', () => {
    const encryptedEvent = {
      getType: () => 'm.room.encrypted',
      getWireType: () => 'm.room.encrypted',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_enc_deleted',
      getTs: () => 1000,
      isDecryptionFailure: () => true,
    }
    const redactionEvent = {
      getType: () => 'm.room.redaction',
      getRedacts: () => 'evt_enc_deleted',
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [encryptedEvent, redactionEvent],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(1)
    messages[0]!.body.should.equal('Message deleted')
    messages[0]!.isMessageDeleted!.should.equal(true)
    messages[0]!.isDecryptionError!.should.equal(false)
    messages[0]!.body.should.not.include('could not be decrypted')
  })

  it('maps redacted plaintext with empty body to tombstone', () => {
    const deletedMessage = {
      getType: () => 'm.room.message',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_plain_deleted',
      getTs: () => 1000,
      getContent: () => ({}),
      isDecryptionFailure: () => false,
    }
    const redactionEvent = {
      getType: () => 'm.room.redaction',
      getRedacts: () => 'evt_plain_deleted',
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [deletedMessage, redactionEvent],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(1)
    messages[0]!.body.should.equal('Message deleted')
    messages[0]!.isMessageDeleted!.should.equal(true)
    messages[0]!.body.should.not.equal('Unsupported message content.')
  })

  it('shows tombstone in reply preview when target was redacted', () => {
    const originalEvent = {
      getType: () => 'm.room.encrypted',
      getWireType: () => 'm.room.encrypted',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_redacted_target',
      getTs: () => 1000,
      isDecryptionFailure: () => true,
    }
    const replyEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_reply_redacted',
      getTs: () => 2000,
      getContent: () => ({
        body: 'Still here',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': { event_id: 'evt_redacted_target' },
        },
      }),
      isDecryptionFailure: () => false,
    }
    const redactionEvent = {
      getType: () => 'm.room.redaction',
      getRedacts: () => 'evt_redacted_target',
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [originalEvent, replyEvent, redactionEvent],
      }),
      getMembers: () => [],
      getMember: (userId: string) => {
        if (userId === '@alice:example.org') {
          return { name: 'Alice' }
        }
        return { name: 'Bob' }
      },
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    const reply = messages.find((message) => message.id === 'evt_reply_redacted')
    reply!.replyTo!.body.should.equal('Message deleted')
  })

  it('includes redacted encrypted reply in thread view', () => {
    const rootEvent = {
      getType: () => 'm.room.message',
      getSender: () => '@alice:example.org',
      getId: () => 'evt_thread_root',
      getTs: () => 1000,
      getContent: () => ({ body: 'Root', msgtype: 'm.text' }),
      isDecryptionFailure: () => false,
    }
    const encryptedReply = {
      getType: () => 'm.room.encrypted',
      getWireType: () => 'm.room.encrypted',
      getSender: () => '@bob:example.org',
      getId: () => 'evt_thread_reply_enc',
      getTs: () => 2000,
      isDecryptionFailure: () => true,
      getContent: () => ({
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: 'evt_thread_root',
          is_falling_back: true,
          'm.in_reply_to': { event_id: 'evt_thread_root' },
        },
      }),
    }
    const redactionEvent = {
      getType: () => 'm.room.redaction',
      getRedacts: () => 'evt_thread_reply_enc',
    }
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [rootEvent, encryptedReply, redactionEvent],
      }),
      getMembers: () => [],
      getMember: (userId: string) => ({ name: userId }),
      hasUserReadEvent: () => false,
    }

    const threadMessages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
      mode: { kind: 'thread', rootEventId: 'evt_thread_root' },
    })

    const deletedReply = threadMessages.find(
      (message) => message.id === 'evt_thread_reply_enc',
    )
    deletedReply!.body.should.equal('Message deleted')
    deletedReply!.isMessageDeleted!.should.equal(true)
  })
})
