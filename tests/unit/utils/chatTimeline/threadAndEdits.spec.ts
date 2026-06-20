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

describe('chatTimeline thread nav and edits', () => {
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
