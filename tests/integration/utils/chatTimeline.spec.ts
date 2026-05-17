import { describe, it } from 'vitest'
import {
  mapTimelineEventsToMessages,
  resolveTimelineWindowSelection
} from '~/utils/chatTimeline'

const buildDeletedMessageText = () => 'Message deleted'

function createTimelineEvent(
  id: string,
  type: string,
  sender: string,
  body?: string
): Record<string, any> {
  return {
    getId: () => id,
    getType: () => type,
    getWireType: () => type,
    getSender: () => sender,
    getContent: () => ({ body }),
    isDecryptionFailure: () => false
  }
}

describe('chatTimeline integration', () => {
  it('maps decrypted and undecryptable events safely', () => {
    const decryptedMessage = createTimelineEvent(
      'evt1',
      'm.room.message',
      '@alice:example.org',
      'Hello'
    )
    const undecryptableMessage = {
      ...createTimelineEvent(
        'evt2',
        'm.room.encrypted',
        '@bob:example.org'
      ),
      getWireType: () => 'm.room.encrypted'
    }
    const roomNameEvent = createTimelineEvent(
      'evt3',
      'm.room.name',
      '@alice:example.org'
    )
    const roomMembers = [
      { userId: '@alice:example.org', name: 'Alice' },
      { userId: '@bob:example.org', name: 'Bob' },
      { userId: '@me:example.org', name: 'Me' }
    ]
    const room = {
      getLiveTimeline: () => ({
        getEvents: () => [decryptedMessage, undecryptableMessage, roomNameEvent]
      }),
      getMembers: () => roomMembers,
      getMember: (userId: string) => {
        return roomMembers.find((member) => member.userId === userId)
      },
      hasUserReadEvent: (userId: string, eventId: string) => {
        return userId === '@bob:example.org' && eventId === 'evt1'
      }
    }

    const mapped = mapTimelineEventsToMessages({
      room,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => 'Room updated'
    })

    mapped.length.should.equal(3)
    mapped[0]?.kind.should.equal('message')
    mapped[0]?.body.should.equal('Hello')
    mapped[0]?.readBy.length.should.equal(1)
    mapped[1]?.kind.should.equal('notice')
    mapped[1]?.isDecryptionError.should.equal(true)
    mapped[1]?.body.should.include('could not be decrypted')
    mapped[2]?.body.should.equal('Room updated')
  })

  it('maps redacted encrypted message to deleted tombstone', () => {
    const encryptedEvent = {
      ...createTimelineEvent(
        'evt_redacted_enc',
        'm.room.encrypted',
        '@alice:example.org',
      ),
      isDecryptionFailure: () => true,
    }
    const redactionEvent = {
      getId: () => 'evt_redact',
      getType: () => 'm.room.redaction',
      getRedacts: () => 'evt_redacted_enc',
      getContent: () => ({}),
    }
    const room = {
      getLiveTimeline: () => ({
        getEvents: () => [encryptedEvent, redactionEvent],
      }),
      getMembers: () => [],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false,
    }

    const mapped = mapTimelineEventsToMessages({
      room,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => 'ignored',
    })

    mapped.length.should.equal(1)
    mapped[0]!.body.should.equal('Message deleted')
    mapped[0]!.isMessageDeleted!.should.equal(true)
    mapped[0]!.isDecryptionError!.should.equal(false)
  })

  it('maps mixed timeline with text and image messages', () => {
    const textMessage = createTimelineEvent(
      'evt10',
      'm.room.message',
      '@alice:example.org',
      'Hello image feed'
    )
    const imageMessage = {
      ...createTimelineEvent(
        'evt11',
        'm.room.message',
        '@alice:example.org',
        'landscape.png'
      ),
      getContent: () => ({
        body: 'landscape.png',
        msgtype: 'm.image',
        url: 'mxc://example.org/landscape',
        info: { mimetype: 'image/png' }
      })
    }
    const room = {
      getLiveTimeline: () => ({
        getEvents: () => [textMessage, imageMessage]
      }),
      getMembers: () => [{ userId: '@alice:example.org', name: 'Alice' }],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false
    }

    const mapped = mapTimelineEventsToMessages({
      room,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: (mxc: string) => `http://cdn/${mxc.split('//')[1]}`,
      buildDeletedMessageText,
      buildNoticeText: () => 'ignored'
    })

    mapped.length.should.equal(2)
    mapped[0]?.body.should.equal('Hello image feed')
    ;(mapped[0]?.media === undefined).should.equal(true)
    mapped[1]?.body.should.equal('landscape.png')
    mapped[1]?.media?.url.should.equal('http://cdn/example.org/landscape')
  })

  it('keeps fallback body for image message with invalid media url', () => {
    const invalidImageMessage = {
      ...createTimelineEvent(
        'evt12',
        'm.room.message',
        '@alice:example.org',
        'broken-image.jpg'
      ),
      getContent: () => ({
        body: 'broken-image.jpg',
        msgtype: 'm.image'
      })
    }
    const room = {
      getLiveTimeline: () => ({
        getEvents: () => [invalidImageMessage]
      }),
      getMembers: () => [{ userId: '@alice:example.org', name: 'Alice' }],
      getMember: () => ({ name: 'Alice' }),
      hasUserReadEvent: () => false
    }

    const mapped = mapTimelineEventsToMessages({
      room,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => 'ignored'
    })

    mapped.length.should.equal(1)
    mapped[0]?.body.should.equal('broken-image.jpg')
    ;(mapped[0]?.media === undefined).should.equal(true)
  })

  it('maps reply chains from in-reply-to relations', () => {
    const originalMessage = createTimelineEvent(
      'evt20',
      'm.room.message',
      '@alice:example.org',
      'Root message'
    )
    const firstReply = {
      ...createTimelineEvent(
        'evt21',
        'm.room.message',
        '@bob:example.org',
        'First reply'
      ),
      getContent: () => ({
        body: 'First reply',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: 'evt20'
          }
        }
      })
    }
    const secondReply = {
      ...createTimelineEvent(
        'evt22',
        'm.room.message',
        '@alice:example.org',
        'Second reply'
      ),
      getContent: () => ({
        body: 'Second reply',
        msgtype: 'm.text',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: 'evt21'
          }
        }
      })
    }
    const roomMembers = [
      { userId: '@alice:example.org', name: 'Alice' },
      { userId: '@bob:example.org', name: 'Bob' }
    ]
    const room = {
      getLiveTimeline: () => ({
        getEvents: () => [originalMessage, firstReply, secondReply]
      }),
      getMembers: () => roomMembers,
      getMember: (userId: string) => {
        return roomMembers.find((member) => member.userId === userId)
      },
      hasUserReadEvent: () => false
    }

    const mapped = mapTimelineEventsToMessages({
      room,
      ownUserId: '@me:example.org',
      getMemberAvatarUrl: () => undefined,
      getMediaUrl: () => undefined,
      buildDeletedMessageText,
      buildNoticeText: () => ''
    })

    mapped.length.should.equal(3)
    mapped[1]?.replyTo?.eventId.should.equal('evt20')
    mapped[1]?.replyTo?.senderName.should.equal('Alice')
    mapped[2]?.replyTo?.eventId.should.equal('evt21')
    mapped[2]?.replyTo?.senderName.should.equal('Bob')
  })

  it('creates a centered initial window around read anchor', () => {
    const selection = resolveTimelineWindowSelection(
      ['evt1', 'evt2', 'evt3', 'evt4', 'evt5', 'evt6'],
      {
        windowSize: 4,
        anchorEventId: 'evt4'
      }
    )
    selection.startIndex.should.equal(1)
    selection.endIndex.should.equal(5)
    selection.anchorFound.should.equal(true)
  })
})
