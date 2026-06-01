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

describe('chatTimeline reactions and window', () => {
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
})
