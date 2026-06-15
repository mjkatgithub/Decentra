import { readMessageRelationSnapshot } from '~/utils/matrixThreadRelations'
import {
  buildReactionSummaryByEventId,
  buildReplyMetadata,
  buildTimelineMediaFromContent,
  buildUndecryptableMessageText,
  getMessageBody,
  getRedactedEventIds,
  isDecryptableChatMessageEvent,
  isRedactedMessageEvent,
  isUndecryptableEvent,
  readChatMessageContent,
} from './reactionsAndMedia'
import {
  buildMessageRelationIndex,
  buildThreadSummariesByRoot,
  collectMessageTimelineEvents,
  filterTimelineEventsByType,
  shouldIncludeMessageInMainTimeline,
  shouldIncludeMessageInThreadView,
  sortTimelineMessagesByOriginTs,
} from './relations'
import type {
  ChatTimelineMedia,
  ChatTimelineMessage,
  MapTimelineArgs,
  TimelineMappingMode,
} from './types'

export function mapTimelineEventsToMessages({
  room,
  ownUserId,
  getMemberAvatarUrl,
  getMediaUrl,
  buildNoticeText,
  buildDeletedMessageText,
  mode = { kind: 'main' } as TimelineMappingMode,
}: MapTimelineArgs & { mode?: TimelineMappingMode }): ChatTimelineMessage[] {
  const allTimelineEvents = room.getLiveTimeline().getEvents()
  const redactedEventIds = getRedactedEventIds(allTimelineEvents)
  const deletedMessageText = buildDeletedMessageText()
  const messageEvents = collectMessageTimelineEvents(allTimelineEvents)
  const relationIndex = buildMessageRelationIndex(messageEvents)
  const reactionSummaryByEventId = buildReactionSummaryByEventId(
    allTimelineEvents,
    ownUserId,
  )
  const threadSummariesByRoot =
    mode.kind === 'main'
      ? buildThreadSummariesByRoot(
          room,
          getMemberAvatarUrl,
          buildDeletedMessageText,
        )
      : null
  const threadRootEventId =
    mode.kind === 'thread' ? mode.rootEventId : undefined

  const typedTimelineEvents = filterTimelineEventsByType(
    room.getLiveTimeline().getEvents(),
  )

  const timelineEvents =
    mode.kind === 'main'
      ? typedTimelineEvents.filter((timelineEvent) => {
          return shouldIncludeMessageInMainTimeline(
            timelineEvent,
            relationIndex,
          )
        })
      : typedTimelineEvents.filter((timelineEvent) => {
          return shouldIncludeMessageInThreadView(
            timelineEvent,
            mode.rootEventId,
            relationIndex,
            redactedEventIds,
          )
        })

  const timelineEventsById = new Map<string, Record<string, any>>()
  for (const timelineEvent of typedTimelineEvents) {
    const timelineEventId = timelineEvent.getId?.()
    if (timelineEventId) {
      timelineEventsById.set(timelineEventId, timelineEvent)
    }
  }
  const visibleMessageEvents = timelineEvents.filter(
    (timelineEvent: Record<string, any>) => {
      return (
        isDecryptableChatMessageEvent(timelineEvent) &&
        !isUndecryptableEvent(timelineEvent)
      )
    },
  )
  const roomMembers = room.getMembers()
  const latestReadEventIdByUser = new Map<string, string>()

  for (const member of roomMembers) {
    if (member.userId === ownUserId) {
      continue
    }
    for (
      let messageIndex = visibleMessageEvents.length - 1;
      messageIndex >= 0;
      messageIndex--
    ) {
      const messageEvent = visibleMessageEvents[messageIndex]
      if (!messageEvent) {
        continue
      }
      const messageEventId = messageEvent.getId()
      if (!messageEventId) {
        continue
      }
      if (room.hasUserReadEvent(member.userId, messageEventId)) {
        latestReadEventIdByUser.set(member.userId, messageEventId)
        break
      }
    }
  }

  const mappedMessages = timelineEvents.map(
    (timelineEvent: Record<string, any>) => {
      try {
        const eventType = timelineEvent.getType?.() ?? ''
        const senderUserId = timelineEvent.getSender?.() ?? ''
        const senderMember = room.getMember(senderUserId)
        const senderName = senderMember?.name || senderUserId
        const currentEventId = timelineEvent.getId?.() ?? ''
        const redactedMessage = isRedactedMessageEvent(
          timelineEvent,
          redactedEventIds,
        )
        const isChatMessage = isDecryptableChatMessageEvent(timelineEvent)
        const undecryptableMessage =
          !redactedMessage && isUndecryptableEvent(timelineEvent)
        const isMessageEvent =
          isChatMessage || undecryptableMessage || redactedMessage
        const body = isMessageEvent
          ? getMessageBody(timelineEvent, senderName, undecryptableMessage, {
              redactedMessage,
              deletedMessageText,
            })
          : buildNoticeText(timelineEvent, room)

        const readBy =
          isChatMessage &&
          !undecryptableMessage &&
          !redactedMessage &&
          currentEventId
            ? roomMembers
                .filter(
                  (member: Record<string, any>) =>
                    member.userId !== senderUserId,
                )
                .filter(
                  (member: Record<string, any>) =>
                    member.userId !== ownUserId,
                )
                .filter((member: Record<string, any>) => {
                  return (
                    latestReadEventIdByUser.get(member.userId) ===
                    currentEventId
                  )
                })
                .filter((member: Record<string, any>) => {
                  return room.hasUserReadEvent(
                    member.userId,
                    currentEventId,
                  )
                })
                .map((member: Record<string, any>) => ({
                  userId: member.userId,
                  displayName: member.name || member.userId,
                  avatarUrl: getMemberAvatarUrl(member),
                }))
            : []

        const content = readChatMessageContent(timelineEvent)
        const relationSnapshot = isChatMessage
          ? readMessageRelationSnapshot(timelineEvent)
          : undefined
        const reactions =
          isChatMessage && currentEventId
            ? (reactionSummaryByEventId.get(currentEventId) ?? [])
            : []
        let media: ChatTimelineMedia | undefined
        const replyTo =
          isChatMessage && !undecryptableMessage
            ? buildReplyMetadata(
                content,
                room,
                timelineEventsById,
                redactedEventIds,
                deletedMessageText,
                getMediaUrl,
                threadRootEventId,
              )
            : undefined

        if (isChatMessage) {
          media = buildTimelineMediaFromContent({
            content,
            body,
            getMediaUrl,
          })
        }

        const messageKind: ChatTimelineMessage['kind'] =
          isChatMessage &&
          !undecryptableMessage &&
          !redactedMessage
            ? 'message'
            : 'notice'

        return {
          id: currentEventId,
          kind: messageKind,
          isDecryptionError: undecryptableMessage,
          isMessageDeleted: redactedMessage,
          senderId: senderUserId,
          senderName,
          avatarUrl: senderMember
            ? getMemberAvatarUrl(senderMember)
            : undefined,
          body,
          replyTo,
          media,
          reactions,
          readBy,
          isEdited: relationSnapshot?.isReplacement === true,
          editTargetEventId:
            isChatMessage &&
            !undecryptableMessage &&
            !redactedMessage
              ? (relationSnapshot?.replaceTargetId ?? currentEventId)
              : undefined,
          originServerTs:
            relationIndex.displayTsByEventId.get(currentEventId) ??
            Number(timelineEvent.getTs?.() ?? 0),
        }
      } catch {
        const senderUserId = timelineEvent.getSender?.() ?? ''
        const senderMember = room.getMember(senderUserId)
        const senderName = senderMember?.name || senderUserId
        const currentEventId = timelineEvent.getId?.() ?? ''
        const redactedMessage = isRedactedMessageEvent(
          timelineEvent,
          redactedEventIds,
        )
        const fallbackNotice: ChatTimelineMessage = {
          id: currentEventId || `${timelineEvent.getTs?.() ?? Date.now()}`,
          kind: 'notice',
          isDecryptionError: !redactedMessage,
          isMessageDeleted: redactedMessage,
          senderId: senderUserId,
          senderName,
          avatarUrl: senderMember
            ? getMemberAvatarUrl(senderMember)
            : undefined,
          body: redactedMessage
            ? deletedMessageText
            : buildUndecryptableMessageText(senderName),
          reactions: [],
          readBy: [],
          originServerTs: Number(timelineEvent.getTs?.() ?? 0),
        }
        return fallbackNotice
      }
    },
  )

  const sortedMessages = sortTimelineMessagesByOriginTs(mappedMessages)

  if (mode.kind !== 'main' || !threadSummariesByRoot) {
    return sortedMessages
  }

  return sortedMessages.map((msg) => {
    if (msg.kind !== 'message') {
      return msg
    }
    const summary = threadSummariesByRoot.get(msg.id)
    if (!summary) {
      return msg
    }
    return { ...msg, threadSummary: summary }
  })
}
