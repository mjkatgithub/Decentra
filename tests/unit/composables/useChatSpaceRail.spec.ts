import { describe, expect, it } from 'vitest'
import { ref, nextTick } from 'vue'
import { useChatSpaceRail } from '~/composables/chat/useChatSpaceRail'
import { HOME_SPACE_ID } from '~/utils/spaceUnread'

function createMatrixRoom(
  roomId: string,
  options: {
    name?: string
    type?: string
    parentSpaceIds?: string[]
    membership?: string
    childRoomIds?: string[]
  } = {},
) {
  const parentSpaceIds = options.parentSpaceIds ?? []
  const childRoomIds = options.childRoomIds ?? []
  return {
    roomId,
    name: options.name ?? roomId,
    getType: () => options.type,
    getMyMembership: () => options.membership ?? 'join',
    currentState: {
      getStateEvents: (eventType?: string) => {
        if (eventType === 'm.space.parent' && parentSpaceIds.length > 0) {
          return parentSpaceIds.map((spaceId) => ({
            getStateKey: () => spaceId,
          }))
        }
        if (eventType === 'm.space.child' && childRoomIds.length > 0) {
          return childRoomIds.map((childRoomId) => ({
            getStateKey: () => childRoomId,
            getContent: () => ({}),
          }))
        }
        return undefined
      },
    },
  }
}

describe('useChatSpaceRail room selection', () => {
  it('does not auto-select a room when none is selected', async () => {
    const selectedSpaceId = ref<string | null>(HOME_SPACE_ID)
    const selectedRoomId = ref<string | null>(null)
    const matrixRooms = ref([
      createMatrixRoom('!dm:example.org', {
        name: 'DM',
        parentSpaceIds: [],
      }),
    ] as never[])

    const spaceRail = useChatSpaceRail({
      client: ref(null),
      matrixRooms,
      selectedSpaceId,
      selectedRoomId,
      pendingRootSpaceId: ref(null),
      translateText: (key) => key,
      getSpaceAvatarUrl: () => undefined,
      matrixSyncPrepared: ref(true),
      spaceUnreadById: ref({}),
      allMessages: ref([]),
      messages: ref([]),
    })

    spaceRail.setupSpaceRailWatchers()
    await nextTick()

    expect(selectedRoomId.value).toBeNull()
  })

  it('clears stale room selection instead of auto-picking another', async () => {
    const spaceId = '!space:example.org'
    const staleRoomId = '!stale:example.org'
    const otherRoomId = '!other:example.org'
    const selectedSpaceId = ref<string | null>(spaceId)
    const selectedRoomId = ref<string | null>(staleRoomId)
    const matrixRooms = ref([
      createMatrixRoom(spaceId, {
        name: 'Team',
        type: 'm.space',
      }),
      createMatrixRoom(otherRoomId, {
        name: 'General',
        parentSpaceIds: [spaceId],
      }),
    ] as never[])

    const spaceRail = useChatSpaceRail({
      client: ref(null),
      matrixRooms,
      selectedSpaceId,
      selectedRoomId,
      pendingRootSpaceId: ref(null),
      translateText: (key) => key,
      getSpaceAvatarUrl: () => undefined,
      matrixSyncPrepared: ref(true),
      spaceUnreadById: ref({}),
      allMessages: ref([]),
      messages: ref([]),
    })

    spaceRail.setupSpaceRailWatchers()
    await nextTick()

    expect(selectedRoomId.value).toBeNull()
    expect(selectedRoomId.value).not.to.equal(otherRoomId)
  })

  it('keeps room selected when channel is linked via m.space.child only', async () => {
    const spaceId = '!space:example.org'
    const channelId = '!channel:example.org'
    const selectedSpaceId = ref<string | null>(spaceId)
    const selectedRoomId = ref<string | null>(null)
    const matrixRooms = ref([
      createMatrixRoom(spaceId, {
        name: 'Team',
        type: 'm.space',
        childRoomIds: [channelId],
      }),
      createMatrixRoom(channelId, {
        name: 'General',
      }),
    ] as never[])

    const spaceRail = useChatSpaceRail({
      client: ref(null),
      matrixRooms,
      selectedSpaceId,
      selectedRoomId,
      pendingRootSpaceId: ref(null),
      translateText: (key) => key,
      getSpaceAvatarUrl: () => undefined,
      matrixSyncPrepared: ref(true),
      spaceUnreadById: ref({}),
      allMessages: ref([]),
      messages: ref([]),
    })

    spaceRail.setupSpaceRailWatchers()
    await nextTick()

    selectedRoomId.value = channelId
    await nextTick()

    expect(selectedRoomId.value).to.equal(channelId)
  })
})
