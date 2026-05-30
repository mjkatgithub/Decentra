import {
  ClientEvent,
  ConditionKind,
  PushRuleActionName,
  PushRuleKind,
  TweakName,
} from 'matrix-js-sdk'
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import {
  findOverrideMuteRule,
  findRoomPushRule,
  resolveRoomNotificationLevel,
  resolveSpaceNotificationLevel,
  type RoomNotificationLevel,
  type SpaceNotificationLevel,
} from '~/utils/matrixNotificationRules'

const PUSH_RULES_SCOPE = 'global'

export function useNotificationSettings(options: {
  client: Ref<MatrixClient | null>
}) {
  const pushRulesVersion = useState('matrixPushRulesVersion', () => 0)

  function bumpVersion(): void {
    pushRulesVersion.value += 1
  }

  /** Cached push rules from the Matrix client (not the async HTTP getter). */
  function readPushRules(matrixClient: MatrixClient) {
    return matrixClient.pushRules ?? null
  }

  async function refreshPushRules(matrixClient: MatrixClient): Promise<void> {
    await matrixClient.getPushRules()
    bumpVersion()
  }

  function getRoomLevel(roomId: string): RoomNotificationLevel {
    pushRulesVersion.value
    const matrixClient = options.client.value
    if (!matrixClient) {
      return 'default'
    }
    return resolveRoomNotificationLevel(readPushRules(matrixClient), roomId)
  }

  function getSpaceLevel(roomIds: string[]): SpaceNotificationLevel {
    pushRulesVersion.value
    return resolveSpaceNotificationLevel(
      roomIds.map((roomId) => getRoomLevel(roomId)),
    )
  }

  async function deleteOverrideMuteRule(
    matrixClient: MatrixClient,
    roomId: string,
  ): Promise<void> {
    const overrideMuteRule = findOverrideMuteRule(
      readPushRules(matrixClient),
      roomId,
    )
    if (!overrideMuteRule?.rule_id) {
      return
    }
    await matrixClient.deletePushRule(
      PUSH_RULES_SCOPE,
      PushRuleKind.Override,
      overrideMuteRule.rule_id,
    )
  }

  async function deleteRoomPushRule(
    matrixClient: MatrixClient,
    roomId: string,
  ): Promise<void> {
    const roomRule = findRoomPushRule(readPushRules(matrixClient), roomId)
    if (!roomRule?.rule_id) {
      return
    }
    await matrixClient.deletePushRule(
      PUSH_RULES_SCOPE,
      PushRuleKind.RoomSpecific,
      roomRule.rule_id,
    )
  }

  async function setRoomLevel(
    roomId: string,
    level: RoomNotificationLevel,
  ): Promise<void> {
    const matrixClient = options.client.value
    if (!matrixClient || !roomId) {
      return
    }
    try {
      if (level === 'mute') {
        // Match Element Web: drop the room rule, then squelch via override.
        await deleteRoomPushRule(matrixClient, roomId)
        await deleteOverrideMuteRule(matrixClient, roomId)
        await matrixClient.addPushRule(
          PUSH_RULES_SCOPE,
          PushRuleKind.Override,
          roomId,
          {
            conditions: [
              {
                kind: ConditionKind.EventMatch,
                key: 'room_id',
                pattern: roomId,
              },
            ],
            actions: [PushRuleActionName.DontNotify],
          },
        )
        await refreshPushRules(matrixClient)
        return
      }

      await deleteOverrideMuteRule(matrixClient, roomId)

      if (level === 'default') {
        await deleteRoomPushRule(matrixClient, roomId)
      } else if (level === 'all') {
        await matrixClient.addPushRule(
          PUSH_RULES_SCOPE,
          PushRuleKind.RoomSpecific,
          roomId,
          {
            actions: [
              PushRuleActionName.Notify,
              { set_tweak: TweakName.Sound, value: 'default' },
            ],
          },
        )
      } else if (level === 'mentions') {
        await matrixClient.addPushRule(
          PUSH_RULES_SCOPE,
          PushRuleKind.RoomSpecific,
          roomId,
          {
            actions: [PushRuleActionName.DontNotify],
          },
        )
      }
      await refreshPushRules(matrixClient)
    } catch (thrownError) {
      console.error('setRoomLevel failed', thrownError)
    }
  }

  async function setSpaceLevel(
    roomIds: string[],
    level: RoomNotificationLevel,
  ): Promise<void> {
    for (const roomId of roomIds) {
      await setRoomLevel(roomId, level)
    }
  }

  watch(
    () => options.client.value,
    (matrixClient, _previousClient, onCleanup) => {
      if (!matrixClient) {
        return
      }
      const accountDataHandler = (event: MatrixEvent): void => {
        if (event.getType?.() === 'm.push_rules') {
          bumpVersion()
        }
      }
      matrixClient.on(ClientEvent.AccountData, accountDataHandler)
      onCleanup(() => {
        matrixClient.off(ClientEvent.AccountData, accountDataHandler)
      })
    },
    { immediate: true },
  )

  return {
    pushRulesVersion,
    getRoomLevel,
    getSpaceLevel,
    setRoomLevel,
    setSpaceLevel,
  }
}
