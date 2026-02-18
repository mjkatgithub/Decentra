import { describe, it } from 'vitest'
import { mapTimelineEventsToMessages } from '~/utils/chatTimeline'

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
})
