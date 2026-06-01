import type { MatrixClient } from 'matrix-js-sdk'
import { EventType, MsgType } from 'matrix-js-sdk'
import {
  findLatestReadableRoomMessageEvent,
  findLatestReadableThreadMessageEvent,
} from '~/utils/roomUnread'
import {
  validateAudioFile,
  validateVideoFile,
} from '~/utils/mediaUploadValidation'
import { readAudioDurationMs } from '~/utils/voiceRecorder'
import {
  captureVideoThumbnail,
  readVideoMetadata,
} from '~/utils/videoMetadata'
import { buildTextEditContent } from '~/utils/matrixMessageEdit'
import { buildThreadRelatesTo } from '~/utils/matrixThreadRelations'
import type {
  ImageInfo,
  MatrixEncryptedFile,
  MessageReplyOptions,
  ReactionToggleOptions,
  SendAudioMessageOptions,
  SendImageMessageOptions,
  SendTextMessageOptions,
  SendVideoMessageOptions,
} from './matrixClientTypes'
import {
  encryptAttachmentData,
  extractMxcUrl,
  getAudioInfo,
  getImageInfo,
  getVideoInfo,
  isRoomEncrypted,
  readImageDimensions,
  uploadEncryptedAttachment,
  uploadPlainAttachment,
} from './mediaUpload'

export function normalizeSendTextOptions(
  options?: MessageReplyOptions | SendTextMessageOptions,
): SendTextMessageOptions {
  if (!options) {
    return {}
  }
  if ('threadRootEventId' in options || 'replyTo' in options) {
    return options as SendTextMessageOptions
  }
  return { replyTo: options as MessageReplyOptions }
}

export function applyMessageRelations(
  content: Record<string, unknown>,
  options?: SendTextMessageOptions,
): void {
  const normalized = normalizeSendTextOptions(options)
  const threadRootId = normalized.threadRootEventId
  const replyEventId = normalized.replyTo?.eventId
  if (threadRootId) {
    content['m.relates_to'] = buildThreadRelatesTo({
      threadRootEventId: threadRootId,
      inReplyToEventId: replyEventId,
    })
  } else if (replyEventId) {
    content['m.relates_to'] = {
      'm.in_reply_to': {
        event_id: replyEventId,
      },
    }
  }
}

export async function markRoomAsRead(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<void> {
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    return
  }
  const latestMessageEvent = findLatestReadableRoomMessageEvent(room)
  if (!latestMessageEvent) {
    return
  }
  const eventId = latestMessageEvent.getId()
  if (!eventId) {
    return
  }
  try {
    await matrixClient.sendReadReceipt(latestMessageEvent)
    await matrixClient.setRoomReadMarkers(
      roomId,
      eventId,
      latestMessageEvent,
    )
  } catch (thrownError) {
    console.error('markRoomAsRead failed', thrownError)
  }
}

export async function markThreadAsRead(
  matrixClient: MatrixClient,
  roomId: string,
  threadRootEventId: string,
): Promise<void> {
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    return
  }
  const latestThreadEvent = findLatestReadableThreadMessageEvent(
    room,
    threadRootEventId,
  )
  if (!latestThreadEvent) {
    return
  }
  const eventId = latestThreadEvent.getId()
  if (!eventId) {
    return
  }
  try {
    await matrixClient.sendReadReceipt(latestThreadEvent)
    await matrixClient.setRoomReadMarkers(
      roomId,
      eventId,
      latestThreadEvent,
    )
  } catch (thrownError) {
    console.error('markThreadAsRead failed', thrownError)
  }
}

export async function sendRoomTyping(
  matrixClient: MatrixClient,
  roomId: string,
  isTyping: boolean,
  timeoutMs: number,
): Promise<void> {
  await matrixClient.sendTyping(roomId, isTyping, timeoutMs)
}

export async function sendMessage(
  matrixClient: MatrixClient,
  roomId: string,
  body: string,
  options?: MessageReplyOptions | SendTextMessageOptions,
): Promise<void> {
  const normalized = normalizeSendTextOptions(options)
  const content: Record<string, unknown> = {
    msgtype: MsgType.Text,
    body,
  }

  applyMessageRelations(content, normalized)

  await matrixClient.sendEvent(
    roomId,
    EventType.RoomMessage,
    content as Parameters<MatrixClient['sendEvent']>[2],
  )
}

export async function sendEditMessage(
  matrixClient: MatrixClient,
  roomId: string,
  newBody: string,
  targetEventId: string,
): Promise<void> {
  const trimmedBody = newBody.trim()
  if (!trimmedBody) {
    throw new Error('Edit body cannot be empty')
  }
  const content = buildTextEditContent(trimmedBody, targetEventId)
  await matrixClient.sendEvent(
    roomId,
    EventType.RoomMessage,
    content as Parameters<MatrixClient['sendEvent']>[2],
  )
}

export async function sendImageMessage(
  matrixClient: MatrixClient,
  roomId: string,
  imageFile: File | Blob,
  fileName: string,
  options: SendImageMessageOptions | undefined,
  ensureCryptoReady: () => Promise<boolean>,
): Promise<void> {
  const mimetype = imageFile.type || ''
  if (!mimetype.startsWith('image/')) {
    throw new Error('Only image uploads are supported')
  }
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    throw new Error('Room not found')
  }
  const dimensions = await readImageDimensions(imageFile)
  const imageInfo = getImageInfo(imageFile, dimensions)
  const encryptedRoom = isRoomEncrypted(room)

  const relationOptions: SendTextMessageOptions = {
    replyTo: options?.replyTo,
    threadRootEventId: options?.threadRootEventId,
  }
  const imageContentBase: Record<string, unknown> = {
    msgtype: MsgType.Image,
    body: fileName,
    info: imageInfo,
  }
  applyMessageRelations(imageContentBase, relationOptions)

  if (encryptedRoom) {
    const cryptoReady = await ensureCryptoReady()
    if (!cryptoReady) {
      throw new Error('Encryption is not ready for media upload')
    }
    const plaintextData = await imageFile.arrayBuffer()
    const encryptedResult = await encryptAttachmentData(plaintextData)
    const encryptedBlob = new Blob(
      [encryptedResult.encryptedData],
      { type: 'application/octet-stream' },
    )
    const uploadResponse = await matrixClient.uploadContent(
      encryptedBlob,
      { type: 'application/octet-stream', includeFilename: true },
    )
    const mxcUrl = extractMxcUrl(uploadResponse)
    const encryptedFile: MatrixEncryptedFile = {
      ...encryptedResult.encryptedFile,
      url: mxcUrl,
    }
    await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
      ...imageContentBase,
      file: encryptedFile,
    })
    return
  }

  const uploadResponse = await matrixClient.uploadContent(
    imageFile,
    { type: imageInfo.mimetype, includeFilename: true },
  )
  const mxcUrl = extractMxcUrl(uploadResponse)
  await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
    ...imageContentBase,
    url: mxcUrl,
  })
}

export async function sendAudioMessage(
  matrixClient: MatrixClient,
  roomId: string,
  audioFile: File | Blob,
  fileName: string,
  options: SendAudioMessageOptions | undefined,
  ensureCryptoReady: () => Promise<boolean>,
): Promise<void> {
  const validation = validateAudioFile(
    audioFile,
    audioFile instanceof File ? audioFile.name : fileName,
  )
  if (!validation.ok) {
    if (validation.code === 'tooLarge') {
      throw new Error('Audio file exceeds maximum upload size')
    }
    throw new Error('Only supported audio uploads are allowed')
  }
  const mimetype = validation.mimetype
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    throw new Error('Room not found')
  }
  let durationMs = options?.durationMs
  if (typeof durationMs !== 'number' || durationMs <= 0) {
    durationMs = await readAudioDurationMs(audioFile)
  }
  const audioInfo = getAudioInfo(
    new Blob([audioFile], { type: mimetype }),
    durationMs,
  )
  const encryptedRoom = isRoomEncrypted(room)
  const relationOptions: SendTextMessageOptions = {
    replyTo: options?.replyTo,
    threadRootEventId: options?.threadRootEventId,
  }
  const isVoiceMessage = options?.isVoiceMessage !== false

  const voiceContentBase: Record<string, unknown> = {
    msgtype: MsgType.Audio,
    body: fileName,
    info: audioInfo,
  }
  if (isVoiceMessage) {
    voiceContentBase['org.matrix.msc3245.voice'] = {}
  }
  applyMessageRelations(voiceContentBase, relationOptions)

  if (encryptedRoom) {
    const cryptoReady = await ensureCryptoReady()
    if (!cryptoReady) {
      throw new Error('Encryption is not ready for media upload')
    }
    const plaintextData = await audioFile.arrayBuffer()
    const encryptedResult = await encryptAttachmentData(plaintextData)
    const encryptedBlob = new Blob(
      [encryptedResult.encryptedData],
      { type: 'application/octet-stream' },
    )
    const uploadResponse = await matrixClient.uploadContent(
      encryptedBlob,
      { type: 'application/octet-stream', includeFilename: true },
    )
    const mxcUrl = extractMxcUrl(uploadResponse)
    const encryptedFile: MatrixEncryptedFile = {
      ...encryptedResult.encryptedFile,
      url: mxcUrl,
    }
    await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
      ...voiceContentBase,
      file: encryptedFile,
    })
    return
  }

  const uploadResponse = await matrixClient.uploadContent(
    audioFile,
    { type: audioInfo.mimetype, includeFilename: true },
  )
  const mxcUrl = extractMxcUrl(uploadResponse)
  await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
    ...voiceContentBase,
    url: mxcUrl,
  })
}

export async function sendVideoMessage(
  matrixClient: MatrixClient,
  roomId: string,
  videoFile: File | Blob,
  fileName: string,
  options: SendVideoMessageOptions | undefined,
  ensureCryptoReady: () => Promise<boolean>,
): Promise<void> {
  const validation = validateVideoFile(
    videoFile,
    videoFile instanceof File ? videoFile.name : fileName,
  )
  if (!validation.ok) {
    if (validation.code === 'tooLarge') {
      throw new Error('Video file exceeds maximum upload size')
    }
    throw new Error('Only supported video uploads are allowed')
  }
  const mimetype = validation.mimetype
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    throw new Error('Room not found')
  }
  const metadata = await readVideoMetadata(videoFile)
  const thumbnailBlob = await captureVideoThumbnail(videoFile)
  const encryptedRoom = isRoomEncrypted(room)
  const relationOptions: SendTextMessageOptions = {
    replyTo: options?.replyTo,
    threadRootEventId: options?.threadRootEventId,
  }

  let thumbnailAttachment:
    | { mxcUrl?: string; encryptedFile?: MatrixEncryptedFile; info?: ImageInfo }
    | undefined
  if (thumbnailBlob) {
    const thumbDimensions = await readImageDimensions(thumbnailBlob)
    const thumbInfo = getImageInfo(thumbnailBlob, thumbDimensions)
    if (encryptedRoom) {
      const cryptoReady = await ensureCryptoReady()
      if (!cryptoReady) {
        throw new Error('Encryption is not ready for media upload')
      }
      const encryptedThumb = await uploadEncryptedAttachment(
        matrixClient,
        thumbnailBlob,
      )
      thumbnailAttachment = {
        encryptedFile: encryptedThumb,
        info: thumbInfo,
      }
    } else {
      const thumbMxcUrl = await uploadPlainAttachment(
        matrixClient,
        thumbnailBlob,
        'image/jpeg',
      )
      thumbnailAttachment = {
        mxcUrl: thumbMxcUrl,
        info: thumbInfo,
      }
    }
  }

  const videoInfo = getVideoInfo(
    videoFile,
    metadata,
    mimetype,
    thumbnailAttachment,
  )
  const videoContentBase: Record<string, unknown> = {
    msgtype: MsgType.Video,
    body: fileName,
    info: videoInfo,
  }
  applyMessageRelations(videoContentBase, relationOptions)

  if (encryptedRoom) {
    const cryptoReady = await ensureCryptoReady()
    if (!cryptoReady) {
      throw new Error('Encryption is not ready for media upload')
    }
    const encryptedFile = await uploadEncryptedAttachment(
      matrixClient,
      videoFile,
    )
    await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
      ...videoContentBase,
      file: encryptedFile,
    })
    return
  }

  const mxcUrl = await uploadPlainAttachment(
    matrixClient,
    videoFile,
    mimetype,
  )
  await matrixClient.sendEvent(roomId, EventType.RoomMessage, {
    ...videoContentBase,
    url: mxcUrl,
  })
}

export async function loadOlderMessages(
  matrixClient: MatrixClient,
  roomId: string,
): Promise<boolean> {
  const room = matrixClient.getRoom(roomId)
  if (!room) {
    return false
  }
  const timeline = room.getLiveTimeline()
  return matrixClient.paginateEventTimeline(timeline, { backwards: true })
}

export async function sendReaction(
  matrixClient: MatrixClient,
  roomId: string,
  eventId: string,
  emoji: string,
): Promise<void> {
  const trimmedEmoji = emoji.trim()
  if (!trimmedEmoji) {
    throw new Error('Emoji is required')
  }
  await matrixClient.sendEvent(roomId, 'm.reaction' as Parameters<
    MatrixClient['sendEvent']
  >[1], {
    'm.relates_to': {
      rel_type: 'm.annotation',
      event_id: eventId,
      key: trimmedEmoji,
    },
  } as Parameters<MatrixClient['sendEvent']>[2])
}

export async function redactEvent(
  matrixClient: MatrixClient,
  roomId: string,
  reactionEventId: string,
): Promise<void> {
  await (matrixClient as MatrixClient & {
    redactEvent: (
      roomId: string,
      eventId: string,
    ) => Promise<unknown>
  }).redactEvent(roomId, reactionEventId)
}

export async function toggleReaction(
  matrixClient: MatrixClient,
  roomId: string,
  messageEventId: string,
  emoji: string,
  options?: ReactionToggleOptions | string[],
): Promise<void> {
  const ownReactionEventIds = Array.isArray(options)
    ? options
    : options?.ownReactionEventIds ?? []
  const firstOwnReactionEventId = ownReactionEventIds[0]
  if (firstOwnReactionEventId) {
    await redactEvent(matrixClient, roomId, firstOwnReactionEventId)
    return
  }
  await sendReaction(matrixClient, roomId, messageEventId, emoji)
}
