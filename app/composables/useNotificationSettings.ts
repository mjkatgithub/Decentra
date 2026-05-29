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
  const pushRulesVersion = ref(0)

  function bumpVersion(): void {
    pushRulesVersion.value += 1
  }

  function readPushRules(matrixClient: MatrixClient) {
    try {
      return matrixClient.getPushRules?.() ?? null
    } catch (thrownError) {
      console.error('getPushRules failed', thrownError)
      return null
    }
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

  async function clearRoomScopedRules(
    matrixClient: MatrixClient,
    roomId: string,
    ruleOptions: { keepRoomRule?: boolean } = {},
  ): Promise<void> {
    const pushRules = readPushRules(matrixClient)
    const overrideMuteRule = findOverrideMuteRule(pushRules, roomId)
    if (overrideMuteRule?.rule_id) {
      await matrixClient.deletePushRule(
        PUSH_RULES_SCOPE,
        PushRuleKind.Override,
        overrideMuteRule.rule_id,
      )
    }
    if (ruleOptions.keepRoomRule) {
      return
    }
    const roomRule = findRoomPushRule(pushRules, roomId)
    if (roomRule?.rule_id) {
      await matrixClient.deletePushRule(
        PUSH_RULES_SCOPE,
        PushRuleKind.RoomSpecific,
        roomRule.rule_id,
      )
    }
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
        // Drop any room rule, then squelch the room via an override rule.
        await clearRoomScopedRules(matrixClient, roomId)
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
            actions: [],
          },
        )
        bumpVersion()
        return
      }

      // Non-mute levels: make sure the override mute rule is gone first.
      await clearRoomScopedRules(matrixClient, roomId, { keepRoomRule: true })

      if (level === 'default') {
        const roomRule = findRoomPushRule(readPushRules(matrixClient), roomId)
        if (roomRule?.rule_id) {
          await matrixClient.deletePushRule(
            PUSH_RULES_SCOPE,
            PushRuleKind.RoomSpecific,
            roomRule.rule_id,
          )
        }
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
            actions: [],
          },
        )
      }
      bumpVersion()
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
