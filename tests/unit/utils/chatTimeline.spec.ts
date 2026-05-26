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
  resolveTimelineWindowSelection
} from '~/utils/chatTimeline'

const buildDeletedMessageText = () => 'Message deleted'

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
    media.url.should.equal('http://server/media/example.org/audio123')
    media.mxcUrl.should.equal('mxc://example.org/audio123')
    media.mimetype!.should.equal('audio/webm')
    media.info?.duration!.should.equal(4200)
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

  it('aggregates reactions by emoji and own user', () => {
    const timelineEvents = [
      {
        getType: () => 'm.reaction',
        getId: () => 'reaction-1',
        getSender: () => '@alice:example.org',
        getContent: () => ({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: 'evt-message',
            key: '👍'
          }
        })
      },
      {
        getType: () => 'm.reaction',
        getId: () => 'reaction-2',
        getSender: () => '@bob:example.org',
        getContent: () => ({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: 'evt-message',
            key: '👍'
          }
        })
      },
      {
        getType: () => 'm.reaction',
        getId: () => 'reaction-3',
        getSender: () => '@alice:example.org',
        getContent: () => ({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: 'evt-message',
            key: '🎉'
          }
        })
      }
    ]

    const summary = buildReactionSummaryByEventId(
      timelineEvents as any,
      '@alice:example.org'
    )

    const messageReactions = summary.get('evt-message')!
    messageReactions.length.should.equal(2)
    messageReactions[0]!.emoji.should.equal('👍')
    messageReactions[0]!.count.should.equal(2)
    messageReactions[0]!.hasOwnReaction.should.equal(true)
    messageReactions[1]!.emoji.should.equal('🎉')
  })

  it('drops redacted reactions from aggregation', () => {
    const timelineEvents = [
      {
        getType: () => 'm.reaction',
        getId: () => 'reaction-redacted',
        getSender: () => '@alice:example.org',
        getContent: () => ({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: 'evt-message',
            key: '👍'
          }
        })
      },
      {
        getType: () => 'm.room.redaction',
        getRedacts: () => 'reaction-redacted'
      }
    ]
    const summary = buildReactionSummaryByEventId(
      timelineEvents as any,
      '@alice:example.org'
    )
    const messageReactions = summary.get('evt-message') ?? []
    messageReactions.length.should.equal(0)
  })

  it('maps message reactions into message payload', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt-message',
            getContent: () => ({
              body: 'Hello',
              msgtype: 'm.text'
            }),
            isDecryptionFailure: () => false
          },
          {
            getType: () => 'm.reaction',
            getId: () => 'reaction-1',
            getSender: () => '@me:example.org',
            getContent: () => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: 'evt-message',
                key: '🔥'
              }
            })
          }
        ]
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
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
    messages[0]!.reactions.length.should.equal(1)
    messages[0]!.reactions[0]!.emoji.should.equal('🔥')
    messages[0]!.reactions[0]!.hasOwnReaction.should.equal(true)
  })

  it('builds bottom-aligned window without anchor', () => {
    const selection = resolveTimelineWindowSelection(
      ['evt1', 'evt2', 'evt3', 'evt4', 'evt5'],
      { windowSize: 3 }
    )
    selection.startIndex.should.equal(2)
    selection.endIndex.should.equal(5)
    selection.anchorFound.should.equal(false)
    ;(selection.anchorIndex === null).should.equal(true)
  })

  it('centers the window around a known anchor', () => {
    const selection = resolveTimelineWindowSelection(
      ['evt1', 'evt2', 'evt3', 'evt4', 'evt5', 'evt6', 'evt7'],
      { windowSize: 5, anchorEventId: 'evt4' }
    )
    selection.startIndex.should.equal(1)
    selection.endIndex.should.equal(6)
    selection.anchorFound.should.equal(true)
    selection.anchorIndex.should.equal(3)
  })

  it('falls back to bottom when anchor is unknown', () => {
    const selection = resolveTimelineWindowSelection(
      ['evt1', 'evt2', 'evt3'],
      { windowSize: 2, anchorEventId: 'evt-missing' }
    )
    selection.startIndex.should.equal(1)
    selection.endIndex.should.equal(3)
    selection.anchorFound.should.equal(false)
    ;(selection.anchorIndex === null).should.equal(true)
  })

  it('extends window to latest when append at bottom', () => {
    const selection = resolvePreservedTimelineWindow({
      previousStartIndex: 0,
      previousEndIndex: 5,
      previousEventCount: 5,
      previousFirstMessageId: 'evt1',
      previousLastMessageId: 'evt5',
      nextEventIds: ['evt1', 'evt2', 'evt3', 'evt4', 'evt5', 'evt6'],
      windowSize: 80,
      stickToBottom: true
    })
    selection.startIndex.should.equal(0)
    selection.endIndex.should.equal(6)
    selection.shouldScrollToBottom.should.equal(true)
  })

  it('does not extend window when scrolled above latest', () => {
    const selection = resolvePreservedTimelineWindow({
      previousStartIndex: 0,
      previousEndIndex: 3,
      previousEventCount: 10,
      previousFirstMessageId: 'evt1',
      previousLastMessageId: 'evt3',
      nextEventIds: [
        'evt1',
        'evt2',
        'evt3',
        'evt4',
        'evt5',
        'evt6',
        'evt7',
        'evt8',
        'evt9',
        'evt10',
        'evt11'
      ],
      windowSize: 80,
      stickToBottom: false
    })
    selection.startIndex.should.equal(0)
    selection.endIndex.should.equal(3)
    selection.shouldScrollToBottom.should.equal(false)
  })

  it('extends window without scroll when latest but not stickToBottom', () => {
    const selection = resolvePreservedTimelineWindow({
      previousStartIndex: 0,
      previousEndIndex: 3,
      previousEventCount: 3,
      previousFirstMessageId: 'evt1',
      previousLastMessageId: 'evt3',
      nextEventIds: ['evt1', 'evt2', 'evt3', 'evt4'],
      windowSize: 80,
      stickToBottom: false
    })
    selection.endIndex.should.equal(4)
    selection.shouldScrollToBottom.should.equal(false)
  })

  it('uses fallback window when previous ids are missing', () => {
    const selection = resolvePreservedTimelineWindow({
      previousStartIndex: 0,
      previousEndIndex: 2,
      previousEventCount: 10,
      nextEventIds: ['evt1', 'evt2', 'evt3', 'evt4', 'evt5'],
      windowSize: 3,
      stickToBottom: false
    })
    selection.startIndex.should.equal(2)
    selection.endIndex.should.equal(5)
    selection.shouldScrollToBottom.should.equal(false)
  })

  it('excludes MSC3440 thread replies from main timeline', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_root',
            getTs: () => 1000,
            getContent: () => ({
              body: 'root text',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_thread_reply',
            getTs: () => 2000,
            getContent: () => ({
              body: 'in thread',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_root',
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: (userId: string) =>
        ({ name: userId === '@alice:example.org' ? 'Alice' : 'Bob' }),
      hasUserReadEvent: () => false,
    }

    const messages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(1)
    messages[0]!.id.should.equal('evt_root')
    messages[0]!.threadSummary!.replyCount.should.equal(1)
  })

  it('maps thread mode to root and replies only', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_root',
            getTs: () => 1000,
            getContent: () => ({
              body: 'root',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_reply',
            getTs: () => 2000,
            getContent: () => ({
              body: 'reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_root',
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'User' }),
      hasUserReadEvent: () => false,
    }

    const threadMsgs = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
      mode: { kind: 'thread', rootEventId: 'evt_root' },
    })

    threadMsgs.length.should.equal(2)
    threadMsgs[0]!.id.should.equal('evt_root')
    threadMsgs[1]!.id.should.equal('evt_reply')
  })

  it('omits reply preview for thread replies to the root', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_root',
            getTs: () => 1000,
            getContent: () => ({
              body: 'root',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_reply',
            getTs: () => 2000,
            getContent: () => ({
              body: 'reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_root',
                'm.in_reply_to': { event_id: 'evt_root' },
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'User' }),
      hasUserReadEvent: () => false,
    }

    const threadMsgs = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
      mode: { kind: 'thread', rootEventId: 'evt_root' },
    })

    threadMsgs.length.should.equal(2)
    ;(threadMsgs[1]?.replyTo === undefined).should.equal(true)
  })

  it('buildThreadSummariesByRoot aggregates replies', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getId: () => 'evt_r',
            getSender: () => '@a:example.org',
            getTs: () => 1,
            getContent: () => ({ body: 'r', msgtype: 'm.text' }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'evt_t1',
            getSender: () => '@b:example.org',
            getTs: () => 2,
            getContent: () => ({
              body: 't1',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_r',
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMember: () => ({ name: 'Bob' }),
    }
    const map = buildThreadSummariesByRoot(mockRoom as any)
    map.get('evt_r')!.replyCount.should.equal(1)
    map.get('evt_r')!.lastReply!.body.should.equal('t1')
  })

  it('buildRoomThreadNavEntries lists roots with replies', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getId: () => 'root_a',
            getSender: () => '@a:example.org',
            getTs: () => 10,
            getContent: () => ({
              body: 'channel topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'tr',
            getSender: () => '@b:example.org',
            getTs: () => 20,
            getContent: () => ({
              body: 'reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_a',
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
    const entries = buildRoomThreadNavEntries(mockRoom as any, {
      nowMs: 20,
    })
    entries.length.should.equal(1)
    entries[0]!.rootEventId.should.equal('root_a')
    entries[0]!.title.should.include('channel topic')
  })

  it('buildRoomThreadNavEntries lists multiple thread roots', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getId: () => 'root_a',
            getSender: () => '@a:example.org',
            getTs: () => 10,
            getContent: () => ({
              body: 'first topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_a',
            getSender: () => '@b:example.org',
            getTs: () => 20,
            getContent: () => ({
              body: 'reply a',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_a',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'root_b',
            getSender: () => '@a:example.org',
            getTs: () => 30,
            getContent: () => ({
              body: 'second topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_b',
            getSender: () => '@b:example.org',
            getTs: () => 40,
            getContent: () => ({
              body: 'reply b',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_b',
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

    const entries = buildRoomThreadNavEntries(mockRoom as any, {
      nowMs: 50,
    })
    entries.length.should.equal(2)
    entries[0]!.rootEventId.should.equal('root_b')
    entries[1]!.rootEventId.should.equal('root_a')
  })

  it('buildRoomThreadNavEntries hides stale threads by age', () => {
    const nowMs = 10 * 24 * 60 * 60 * 1000
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getId: () => 'root_old',
            getSender: () => '@a:example.org',
            getTs: () => 1,
            getContent: () => ({
              body: 'old topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_old',
            getSender: () => '@b:example.org',
            getTs: () => nowMs - (3 * 24 * 60 * 60 * 1000),
            getContent: () => ({
              body: 'old reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_old',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'root_new',
            getSender: () => '@a:example.org',
            getTs: () => 2,
            getContent: () => ({
              body: 'fresh topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_new',
            getSender: () => '@b:example.org',
            getTs: () => nowMs - (60 * 60 * 1000),
            getContent: () => ({
              body: 'fresh reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_new',
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

    const entries = buildRoomThreadNavEntries(mockRoom as any, {
      nowMs,
      maxAgeDays: 2,
    })
    entries.length.should.equal(1)
    entries[0]!.rootEventId.should.equal('root_new')
  })

  it('buildRoomThreadNavEntries can skip the recent-only filter', () => {
    const nowMs = 10 * 24 * 60 * 60 * 1000
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getId: () => 'root_old',
            getSender: () => '@a:example.org',
            getTs: () => 1,
            getContent: () => ({
              body: 'old topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_old',
            getSender: () => '@b:example.org',
            getTs: () => nowMs - (3 * 24 * 60 * 60 * 1000),
            getContent: () => ({
              body: 'old reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_old',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'root_new',
            getSender: () => '@a:example.org',
            getTs: () => 2,
            getContent: () => ({
              body: 'fresh topic',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getId: () => 'reply_new',
            getSender: () => '@b:example.org',
            getTs: () => nowMs - (60 * 60 * 1000),
            getContent: () => ({
              body: 'fresh reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'root_new',
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

    const entries = buildRoomThreadNavEntries(mockRoom as any, {
      nowMs,
      maxAgeDays: null,
    })
    entries.length.should.equal(2)
  })

  it('hides superseded originals from the main timeline', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_original',
            getTs: () => 1000,
            getContent: () => ({
              body: 'old body',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_replace',
            getTs: () => 2000,
            getContent: () => ({
              body: 'new body',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.replace',
                event_id: 'evt_original',
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
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(1)
    messages[0]!.id.should.equal('evt_replace')
    messages[0]!.body.should.equal('new body')
    messages[0]!.isEdited.should.equal(true)
    messages[0]!.editTargetEventId.should.equal('evt_original')
  })

  it('maps editTargetEventId to original id on replace events', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_original',
            getTs: () => 1000,
            getContent: () => ({
              body: 'first',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_replace',
            getTs: () => 2000,
            getContent: () => ({
              body: 'second',
              msgtype: 'm.text',
              'm.new_content': { msgtype: 'm.text', body: 'second' },
              'm.relates_to': {
                rel_type: 'm.replace',
                event_id: 'evt_original',
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
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages[0]!.editTargetEventId.should.equal('evt_original')
  })

  it('sorts replacement messages by original timestamp', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_old',
            getTs: () => 1000,
            getContent: () => ({
              body: 'jojo',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_newer',
            getTs: () => 5000,
            getContent: () => ({
              body: 'asdf',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_replace',
            getTs: () => 99999,
            getContent: () => ({
              body: 'jojo edited',
              msgtype: 'm.text',
              'm.new_content': { msgtype: 'm.text', body: 'jojo edited' },
              'm.relates_to': {
                rel_type: 'm.replace',
                event_id: 'evt_old',
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
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    messages.length.should.equal(2)
    messages[0]!.body.should.equal('jojo edited')
    messages[0]!.originServerTs.should.equal(1000)
    messages[1]!.body.should.equal('asdf')
    messages[1]!.originServerTs.should.equal(5000)
  })

  it('inherits thread membership through edits and in-reply-to', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_root',
            getTs: () => 1000,
            getContent: () => ({
              body: 'root',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_thread',
            getTs: () => 2000,
            getContent: () => ({
              body: 'thread reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_root',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_edit',
            getTs: () => 3000,
            getContent: () => ({
              body: 'thread reply edited',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.replace',
                event_id: 'evt_thread',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_followup',
            getTs: () => 4000,
            getContent: () => ({
              body: 'follow up',
              msgtype: 'm.text',
              'm.relates_to': {
                'm.in_reply_to': { event_id: 'evt_edit' },
              },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'User' }),
      hasUserReadEvent: () => false,
    }

    const mainMessages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    mainMessages.length.should.equal(1)
    mainMessages[0]!.id.should.equal('evt_root')

    const threadMessages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
      mode: { kind: 'thread', rootEventId: 'evt_root' },
    })

    threadMessages.length.should.equal(3)
    threadMessages.map((message) => message.id).should.deep.equal([
      'evt_root',
      'evt_edit',
      'evt_followup',
    ])
    threadMessages[1]!.isEdited.should.equal(true)
  })

  it('inherits thread membership from top-level in_reply_to', () => {
    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'm.room.message',
            getSender: () => '@alice:example.org',
            getId: () => 'evt_root',
            getTs: () => 1000,
            getContent: () => ({
              body: 'root',
              msgtype: 'm.text',
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_thread',
            getTs: () => 2000,
            getContent: () => ({
              body: 'thread reply',
              msgtype: 'm.text',
              'm.relates_to': {
                rel_type: 'm.thread',
                event_id: 'evt_root',
              },
            }),
            isDecryptionFailure: () => false,
          },
          {
            getType: () => 'm.room.message',
            getSender: () => '@bob:example.org',
            getId: () => 'evt_followup',
            getTs: () => 3000,
            getContent: () => ({
              body: 'follow up',
              msgtype: 'm.text',
              'm.in_reply_to': { event_id: 'evt_thread' },
            }),
            isDecryptionFailure: () => false,
          },
        ],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'User' }),
      hasUserReadEvent: () => false,
    }

    const mainMessages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
    })

    mainMessages.length.should.equal(1)
    mainMessages[0]!.id.should.equal('evt_root')

    const threadMessages = mapTimelineEventsToMessages({
      room: mockRoom as any,
      ownUserId: undefined,
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => '',
      mode: { kind: 'thread', rootEventId: 'evt_root' },
    })

    threadMessages.length.should.equal(3)
    mainMessages[0]!.threadSummary!.replyCount.should.equal(2)
  })
})
