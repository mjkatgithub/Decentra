import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  ConditionKind,
  PushRuleActionName,
  PushRuleKind,
} from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'
import { useNotificationSettings } from '~/composables/useNotificationSettings'

const ROOM_ID = '!room:example.org'

function createMockClient(
  pushRules: Record<string, unknown> | null = null,
): MatrixClient {
  const client = {
    pushRules,
    getPushRules: vi.fn(async () => client.pushRules),
    addPushRule: vi.fn(async () => {}),
    deletePushRule: vi.fn(async () => {}),
    on: vi.fn(),
    off: vi.fn(),
  }
  return client as unknown as MatrixClient
}

describe('useNotificationSettings', () => {
  it('reads cached push rules instead of the async getPushRules getter', () => {
    const client = ref<MatrixClient | null>(
      createMockClient({
        global: {
          override: [
            {
              rule_id: ROOM_ID,
              enabled: true,
              conditions: [
                {
                  kind: ConditionKind.EventMatch,
                  key: 'room_id',
                  pattern: ROOM_ID,
                },
              ],
              actions: [PushRuleActionName.DontNotify],
            },
          ],
          room: [],
        },
      }),
    )
    const { getRoomLevel } = useNotificationSettings({ client })
    expect(getRoomLevel(ROOM_ID)).toBe('mute')
  })

  it('writes Element-compatible mute rules and refreshes the cache', async () => {
    const clientRef = ref<MatrixClient | null>(createMockClient(null))
    const matrixClient = clientRef.value!
    matrixClient.getPushRules = vi.fn(async () => {
      matrixClient.pushRules = {
        global: {
          override: [
            {
              rule_id: ROOM_ID,
              enabled: true,
              conditions: [
                {
                  kind: ConditionKind.EventMatch,
                  key: 'room_id',
                  pattern: ROOM_ID,
                },
              ],
              actions: [PushRuleActionName.DontNotify],
            },
          ],
          room: [],
        },
      }
      return matrixClient.pushRules
    })

    const { setRoomLevel, getRoomLevel } = useNotificationSettings({
      client: clientRef,
    })

    await setRoomLevel(ROOM_ID, 'mute')

    expect(matrixClient.addPushRule).toHaveBeenCalledWith(
      'global',
      PushRuleKind.Override,
      ROOM_ID,
      {
        conditions: [
          {
            kind: ConditionKind.EventMatch,
            key: 'room_id',
            pattern: ROOM_ID,
          },
        ],
        actions: [PushRuleActionName.DontNotify],
      },
    )
    expect(matrixClient.getPushRules).toHaveBeenCalled()
    expect(getRoomLevel(ROOM_ID)).toBe('mute')
  })
})
