import { createHmac } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadE2EEnv } from './runtime-e2e-env.mjs'

const currentFilePath = fileURLToPath(import.meta.url)
const workspaceRoot = resolve(dirname(currentFilePath), '..', '..', '..')
loadE2EEnv(workspaceRoot)

const homeserver = process.env.E2E_LOCAL_HOMESERVER || 'http://127.0.0.1:8008'
const roomName = process.env.E2E_TEST_ROOM_NAME || 'Decentra E2E Room'
const sideRoomName =
  process.env.E2E_SIDE_TEST_ROOM_NAME || 'Decentra E2E Side Room'
const primaryLocalpart = process.env.E2E_PRIMARY_LOCALPART || 'e2e-alice'
const primaryPassword = process.env.E2E_PRIMARY_PASSWORD || 'e2e-alice-pass'
const secondaryLocalpart = process.env.E2E_SECONDARY_LOCALPART || 'e2e-bob'
const secondaryPassword = process.env.E2E_SECONDARY_PASSWORD || 'e2e-bob-pass'
const registrationSecret = process.env.SYNAPSE_REGISTRATION_SHARED_SECRET ||
  'decentra-e2e-shared-secret'

function apiUrl(path) {
  return `${homeserver}${path}`
}

function logStep(message) {
  console.log(`[seed] ${message}`)
}

async function requestJson(path, init) {
  const response = await fetch(apiUrl(path), init)
  const bodyText = await response.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!response.ok) {
    throw new Error(`Matrix request failed (${body?.errcode || response.status}): ${path}`)
  }
  return body
}

async function login(localpart, password) {
  return requestJson('/_matrix/client/v3/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password
    })
  })
}

async function registerViaSecret(localpart, password) {
  const endpoint = '/_synapse/admin/v1/register'
  const nonceResponse = await requestJson(endpoint, { method: 'GET' })
  const nonce = nonceResponse.nonce
  const macInput = `${nonce}\u0000${localpart}\u0000${password}\u0000notadmin`
  const mac = createHmac('sha1', registrationSecret).update(macInput).digest('hex')
  return requestJson(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce, username: localpart, password, admin: false, mac })
  })
}

async function ensureUser(localpart, password) {
  try {
    const session = await requestJson('/_matrix/client/v3/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: localpart,
        password,
        auth: { type: 'm.login.dummy' }
      })
    })
    logStep(`ensureUser ${localpart}: registered via dummy`)
    return session
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('M_USER_IN_USE')) {
      logStep(`ensureUser ${localpart}: exists, logging in`)
      return login(localpart, password)
    }
    logStep(
      `ensureUser ${localpart}: dummy failed (${errorMessage}); `
      + 'falling back to shared-secret register',
    )
    return registerViaSecret(localpart, password)
  }
}

async function withAuth(accessToken, path, init = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(init.headers || {}),
    authorization: `Bearer ${accessToken}`
  }
  return requestJson(path, { ...init, headers })
}

async function sendMessage(accessToken, roomId, transactionId, content, eventType = 'm.room.message') {
  return withAuth(
    accessToken,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${eventType}/${transactionId}`,
    { method: 'PUT', body: JSON.stringify(content) }
  )
}

async function uploadImage(accessToken) {
  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ebpNc8AAAAASUVORK5CYII=',
    'base64'
  )
  const uploadResponse = await fetch(
    apiUrl('/_matrix/media/v3/upload?filename=e2e-seeded-image.png'),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'image/png'
      },
      body: imageBytes
    }
  )
  const bodyText = await uploadResponse.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!uploadResponse.ok || !body?.content_uri) {
    throw new Error('Failed to upload seeded image')
  }
  return body.content_uri
}

async function uploadVideo(accessToken) {
  const videoBytes = Buffer.from(
    'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAEHTEU2bdLuTQu1cTLT7p2MhsNUhpWTu5SAzv1ogZ1HiS3AaFtfnqrAv19fF7WikREY24+E1cFJHF6WJByQx1qxs6SI2NQjA==',
    'base64'
  )
  const uploadResponse = await fetch(
    apiUrl('/_matrix/media/v3/upload?filename=e2e-seeded-video.webm'),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'video/webm'
      },
      body: videoBytes
    }
  )
  const bodyText = await uploadResponse.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!uploadResponse.ok || !body?.content_uri) {
    throw new Error('Failed to upload seeded video')
  }
  return body.content_uri
}

async function uploadAudio(accessToken) {
  const audioBytes = Buffer.from('mock-audio-bytes-for-e2e', 'utf8')
  const uploadResponse = await fetch(
    apiUrl('/_matrix/media/v3/upload?filename=e2e-seeded-voice.webm'),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'audio/webm'
      },
      body: audioBytes
    }
  )
  const bodyText = await uploadResponse.text()
  const body = bodyText ? JSON.parse(bodyText) : {}
  if (!uploadResponse.ok || !body?.content_uri) {
    throw new Error('Failed to upload seeded audio')
  }
  return body.content_uri
}

async function main() {
  logStep(`starting seed against ${homeserver}`)
  const primarySession = await ensureUser(primaryLocalpart, primaryPassword)
  const secondarySession = await ensureUser(secondaryLocalpart, secondaryPassword)
  logStep('users ready')
  const roomResponse = await withAuth(primarySession.access_token, '/_matrix/client/v3/createRoom', {
    method: 'POST',
    body: JSON.stringify({
      name: roomName,
      invite: [secondarySession.user_id],
      preset: 'private_chat'
    })
  })
  const roomId = roomResponse.room_id

  const sideRoomResponse = await withAuth(
    primarySession.access_token,
    '/_matrix/client/v3/createRoom',
    {
      method: 'POST',
      body: JSON.stringify({
        name: sideRoomName,
        invite: [secondarySession.user_id],
        preset: 'private_chat',
      }),
    },
  )
  const sideRoomId = sideRoomResponse.room_id
  logStep('main + side rooms created')

  const spaceName = process.env.E2E_TEST_SPACE_NAME || 'Decentra E2E Space'
  const spaceChannelName =
    process.env.E2E_TEST_SPACE_CHANNEL_NAME || 'E2E Space General'
  const spaceResponse = await withAuth(
    primarySession.access_token,
    '/_matrix/client/v3/createRoom',
    {
      method: 'POST',
      body: JSON.stringify({
        name: spaceName,
        creation_content: { type: 'm.space' },
      }),
    },
  )
  const spaceId = spaceResponse.room_id
  const spaceChannelResponse = await withAuth(
    primarySession.access_token,
    '/_matrix/client/v3/createRoom',
    {
      method: 'POST',
      body: JSON.stringify({ name: spaceChannelName }),
    },
  )
  const spaceChannelId = spaceChannelResponse.room_id
  const serverName = new URL(homeserver).hostname
  const via = [serverName]
  await withAuth(
    primarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.space.child/${encodeURIComponent(spaceChannelId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ via, order: 'general' }),
    },
  )
  await withAuth(
    primarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(spaceChannelId)}/state/m.space.parent/${encodeURIComponent(spaceId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ via }),
    },
  )
  logStep('space + channel created and linked')

  await withAuth(
    secondarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
    { method: 'POST', body: '{}' },
  )
  await withAuth(
    secondarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(sideRoomId)}/join`,
    { method: 'POST', body: '{}' },
  )
  await withAuth(
    primarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(spaceChannelId)}/invite`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: secondarySession.user_id }),
    },
  )
  await withAuth(
    secondarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(spaceChannelId)}/join`,
    { method: 'POST', body: '{}' },
  )
  logStep('secondary user joined main/side/space rooms')
  await withAuth(
    primarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption`,
    { method: 'PUT', body: JSON.stringify({ algorithm: 'm.megolm.v1.aes-sha2' }) }
  )
  logStep('encryption enabled on main room')

  const baseEvent = await sendMessage(primarySession.access_token, roomId, 'seed-text-1', {
    msgtype: 'm.text',
    body: 'E2E_SEED_BASE_MESSAGE'
  })
  const uploadedMxcUrl = await uploadImage(primarySession.access_token)
  const imageEvent = await sendMessage(primarySession.access_token, roomId, 'seed-image-1', {
    msgtype: 'm.image',
    body: 'E2E_SEED_IMAGE',
    info: { mimetype: 'image/png', size: 68, w: 1, h: 1 },
    url: uploadedMxcUrl
  })
  const uploadedAudioMxcUrl = await uploadAudio(primarySession.access_token)
  await sendMessage(primarySession.access_token, roomId, 'seed-voice-1', {
    msgtype: 'm.audio',
    body: 'E2E_SEED_VOICE',
    info: { mimetype: 'audio/webm', duration: 1000, size: 28 },
    'org.matrix.msc3245.voice': {},
    url: uploadedAudioMxcUrl
  })
  const uploadedVideoMxcUrl = await uploadVideo(primarySession.access_token)
  await sendMessage(primarySession.access_token, roomId, 'seed-video-1', {
    msgtype: 'm.video',
    body: 'E2E_SEED_VIDEO',
    info: {
      mimetype: 'video/webm',
      duration: 1000,
      size: 117,
      w: 1,
      h: 1,
    },
    url: uploadedVideoMxcUrl,
  })
  await sendMessage(primarySession.access_token, roomId, 'seed-reply-to-image', {
    msgtype: 'm.text',
    body: 'E2E_REPLY_TO_IMAGE',
    'm.relates_to': { 'm.in_reply_to': { event_id: imageEvent.event_id } }
  })
  await sendMessage(primarySession.access_token, roomId, 'seed-invalid-image', {
    msgtype: 'm.image',
    body: 'E2E_INVALID_IMAGE_FALLBACK'
  })
  await sendMessage(primarySession.access_token, roomId, 'seed-reply-1', {
    msgtype: 'm.text',
    body: 'E2E_REPLY_TO_VALID_EVENT',
    'm.relates_to': { 'm.in_reply_to': { event_id: baseEvent.event_id } }
  })
  await sendMessage(primarySession.access_token, roomId, 'seed-reply-missing', {
    msgtype: 'm.text',
    body: 'E2E_REPLY_TO_MISSING_EVENT',
    'm.relates_to': { 'm.in_reply_to': { event_id: '$e2e-missing-event' } }
  })
  await sendMessage(secondarySession.access_token, roomId, 'seed-encrypted-invalid', {
    algorithm: 'm.megolm.v1.aes-sha2',
    ciphertext: 'e2e-invalid-ciphertext',
    device_id: 'E2EDEVICE',
    sender_key: 'e2e-invalid-sender',
    session_id: 'e2e-invalid-session'
  }, 'm.room.encrypted')
  await sendMessage(secondarySession.access_token, roomId, 'seed-post-undecryptable', {
    msgtype: 'm.text',
    body: 'E2E_POST_UNDECRYPTABLE_MESSAGE'
  })
  logStep('seed messages + media sent')

  const leaveDmRoomResponse = await withAuth(
    primarySession.access_token,
    '/_matrix/client/v3/createRoom',
    {
      method: 'POST',
      body: JSON.stringify({
        invite: [secondarySession.user_id],
        is_direct: true,
        preset: 'trusted_private_chat',
      }),
    },
  )
  const leaveDmRoomId = leaveDmRoomResponse.room_id
  await withAuth(
    secondarySession.access_token,
    `/_matrix/client/v3/rooms/${encodeURIComponent(leaveDmRoomId)}/join`,
    { method: 'POST', body: '{}' },
  )
  await withAuth(
    primarySession.access_token,
    `/_matrix/client/v3/user/${encodeURIComponent(primarySession.user_id)}/account_data/m.direct`,
    {
      method: 'PUT',
      body: JSON.stringify({
        [secondarySession.user_id]: [leaveDmRoomId],
      }),
    },
  )
  await sendMessage(
    primarySession.access_token,
    leaveDmRoomId,
    'seed-leave-dm',
    { msgtype: 'm.text', body: 'E2E_LEAVE_DM_SEED' },
  )

  logStep('leave DM room seeded')

  const generatedEnvPath = resolve(workspaceRoot, 'tests/e2e/.env.e2e.generated')
  mkdirSync(dirname(generatedEnvPath), { recursive: true })
  const generatedEnv = [
    'E2E_USE_LOCAL_SYNAPSE=true',
    `E2E_LOCAL_HOMESERVER=${homeserver}`,
    `E2E_MATRIX_HOMESERVER=${homeserver}`,
    `E2E_MATRIX_USER_ID=${primarySession.user_id}`,
    `E2E_MATRIX_USERNAME=${primaryLocalpart}`,
    `E2E_MATRIX_LOGIN_USERNAME=${primaryLocalpart}`,
    `E2E_MATRIX_PASSWORD=${primaryPassword}`,
    `E2E_SECOND_MATRIX_USER_ID=${secondarySession.user_id}`,
    `E2E_SECOND_MATRIX_USERNAME=${secondaryLocalpart}`,
    `E2E_SECOND_MATRIX_PASSWORD=${secondaryPassword}`,
    `E2E_TEST_ROOM_NAME=${roomName}`,
    `E2E_TEST_ROOM_ID=${roomId}`,
    `E2E_SIDE_TEST_ROOM_NAME=${sideRoomName}`,
    `E2E_SIDE_TEST_ROOM_ID=${sideRoomId}`,
    `E2E_TEST_SPACE_NAME=${spaceName}`,
    `E2E_TEST_SPACE_ID=${spaceId}`,
    `E2E_TEST_SPACE_CHANNEL_NAME=${spaceChannelName}`,
    `E2E_TEST_SPACE_CHANNEL_ID=${spaceChannelId}`,
    `E2E_LEAVE_DM_ROOM_ID=${leaveDmRoomId}`,
  ].join('\n')
  writeFileSync(generatedEnvPath, `${generatedEnv}\n`, 'utf8')
  logStep(`wrote credentials to ${generatedEnvPath}`)
  console.log('Synapse E2E seeding completed')
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
