import type { MatrixClient } from 'matrix-js-sdk'
import * as sdk from 'matrix-js-sdk'
import { ClientEvent, EventType, MsgType } from 'matrix-js-sdk'

export function useMatrixClient() {
  const client = useState<MatrixClient | null>('matrix-client', () => null)
  const isLoggedIn = computed(() => client.value !== null)
  const userId = computed(() => client.value?.getUserId() ?? null)

  async function login(
    baseUrl: string,
    username: string,
    password: string
  ): Promise<void> {
    const authClient = sdk.createClient({ baseUrl })
    const authData = await authClient.loginWithPassword(username, password)

    const newClient = sdk.createClient({
      baseUrl,
      accessToken: authData.access_token,
      userId: authData.user_id
    })

    newClient.startClient({ initialSyncLimit: 50 })
    client.value = newClient
  }

  function logout(): void {
    if (client.value) {
      client.value.stopClient()
      client.value = null
    }
  }

  function getRooms(): sdk.Room[] {
    if (!client.value) return []
    return client.value.getRooms()
  }

  function getRoom(roomId: string): sdk.Room | null {
    return client.value?.getRoom(roomId) ?? null
  }

  async function sendMessage(roomId: string, body: string): Promise<void> {
    if (!client.value) throw new Error('Not logged in')
    await client.value.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body
    })
  }

  async function loadOlderMessages(roomId: string): Promise<boolean> {
    const room = client.value?.getRoom(roomId)
    if (!room || !client.value) return false
    const timeline = room.getLiveTimeline()
    return client.value.paginateEventTimeline(timeline, { backwards: true })
  }

  return {
    client,
    isLoggedIn,
    userId,
    login,
    logout,
    getRooms,
    getRoom,
    sendMessage,
    loadOlderMessages
  }
}
