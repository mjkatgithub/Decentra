<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { JoinRule } from 'matrix-js-sdk'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  useSpaceRoles,
  type SpaceRoleEditDraft,
} from '~/composables/useSpaceRoles'
import { useSpacePowerLevelSettings } from '~/composables/useSpacePowerLevelSettings'
import { useSpaceSettings } from '~/composables/useSpaceSettings'
import { buildSpaceRoomCategories } from '~/utils/spaceRoomCategories'
import type { SpaceRoleDefinition } from '~/utils/decentraSpaceRoles'
import { isSpaceRoomFounder } from '~/utils/spaceRolesMatrixSync'
import { canManageSpaceRoles } from '~/utils/matrixSpaceRolePermissions'

const route = useRoute()
const { translateText } = useAppI18n()
const { client, userId } = useMatrixClient()

const spaceId = computed(() => String(route.params.spaceId || ''))
const activeSection = ref<'general' | 'roles' | 'members'>('general')

const {
  displayName,
  displayTopic,
  editableName,
  editableTopic,
  joinRule,
  publishToDirectory,
  publishedAddresses,
  localAddressesExpanded,
  roomVersionLabel,
  recommendedVersion,
  isProfileEditing,
  permissions,
  canManageGeneral,
  avatarPreviewUrl,
  feedbackMessage,
  feedbackTone,
  isSaving,
  isSavingOptions,
  isUpgrading,
  saveProfile,
  clearAvatar,
  startProfileEdit,
  cancelProfileEdit,
  saveJoinRule,
  setPublishToDirectory,
  runSpaceUpgrade,
} = useSpaceSettings(spaceId)

const {
  sortedRoles,
  saveError,
  addRole,
  saveRoleEdits,
  deleteRole,
  reorderRoles,
  assignUserRole,
  ensureInitialRoles,
  reloadFromRoom,
  rolesContent,
} = useSpaceRoles(spaceId)

const canEditRoles = computed(() => {
  const matrixClient = client.value
  const roomId = spaceId.value
  const matrixUserId = userId.value
  if (!matrixClient || !roomId || !matrixUserId) {
    return false
  }
  if (isSpaceRoomFounder(matrixClient, roomId, matrixUserId)) {
    return true
  }
  return canManageSpaceRoles(matrixClient, roomId, matrixUserId)
})

const {
  permissionGroups,
  readFieldValue,
  saveFieldValue,
  isSaving: isSavingPermissions,
} = useSpacePowerLevelSettings(spaceId)

const newRoleName = ref('')
const newRolePowerLevel = ref<number | ''>('')
const avatarFile = ref<File | null>(null)
const editingRoleId = ref<string | null>(null)
const roleEditDraft = ref<SpaceRoleEditDraft | null>(null)
const isSavingRole = ref(false)
const roleSaveMessage = ref('')
const localRolesForDrag = ref<SpaceRoleDefinition[]>([])

watch(
  sortedRoles,
  (roles) => {
    if (editingRoleId.value !== null) {
      return
    }
    localRolesForDrag.value = roles.map((role) => ({ ...role }))
  },
  { immediate: true },
)

async function onRoleDragEnd() {
  if (!canEditRoles.value) {
    return
  }
  await reorderRoles(
    localRolesForDrag.value.map((role) => role.id),
    childRoomIds.value,
  )
}

const childRoomIds = computed(() => {
  const matrixClient = client.value
  if (!matrixClient || !spaceId.value) {
    return []
  }
  const matrixRooms = matrixClient.getRooms()
  const built = buildSpaceRoomCategories({
    rootSpaceId: spaceId.value,
    matrixRooms,
    getRoomType: (room) =>
      (room as { getType?: () => string }).getType?.(),
    getRoomId: (room) => String((room as { roomId: string }).roomId),
    getRoomDisplayName: (room) =>
      String((room as { name?: string }).name || ''),
    generalCategoryLabel: translateText('layout.spaceRoomsCategory'),
  })
  const roomIds = new Set<string>()
  for (const category of built) {
    for (const room of category.rooms) {
      roomIds.add(room.roomId)
    }
  }
  return [...roomIds]
})

const childRoomEntries = computed(() => {
  const matrixClient = client.value
  return childRoomIds.value.map((roomId) => ({
    roomId,
    name:
      matrixClient?.getRoom(roomId)?.name ||
      roomId,
  }))
})

function startEditRole(role: SpaceRoleDefinition) {
  editingRoleId.value = role.id
  roleEditDraft.value = {
    name: role.name,
    color: role.color,
    powerLevel: role.powerLevel,
  }
  roleSaveMessage.value = ''
  saveError.value = ''
}

function cancelEditRole() {
  editingRoleId.value = null
  roleEditDraft.value = null
  roleSaveMessage.value = ''
  saveError.value = ''
}

async function onPermissionFieldChange(
  fieldId: string,
  powerLevel: number,
) {
  const field = permissionGroups
    .flatMap((group) => group.fields)
    .find((entry) => entry.id === fieldId)
  if (!field || !canEditRoles.value) {
    return
  }
  try {
    await saveFieldValue(field, powerLevel)
    reloadFromRoom()
  } catch {
    /* saveError shown via UAlert */
  }
}

async function handleSaveRoleEdits() {
  const roleId = editingRoleId.value
  const draft = roleEditDraft.value
  if (!roleId || !draft) {
    return
  }
  isSavingRole.value = true
  roleSaveMessage.value = ''
  try {
    const saved = await saveRoleEdits(roleId, draft, childRoomIds.value)
    if (saved) {
      roleSaveMessage.value = 'saved'
      cancelEditRole()
      reloadFromRoom()
    }
  } finally {
    isSavingRole.value = false
  }
}

onMounted(async () => {
  if (!client.value?.getRoom(spaceId.value)) {
    await navigateTo('/chat')
    return
  }
  await ensureInitialRoles(childRoomIds.value)
})

const feedbackTitle = computed(() => {
  if (!feedbackMessage.value) {
    return ''
  }
  if (feedbackMessage.value === 'saved') {
    return translateText('settings.saved')
  }
  return feedbackMessage.value
})

const roleSaveTitle = computed(() => {
  if (roleSaveMessage.value === 'saved') {
    return translateText('settings.saved')
  }
  return ''
})

async function handleSaveProfile() {
  await saveProfile(avatarFile.value)
  avatarFile.value = null
}

function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  avatarFile.value = file ?? null
}

async function handleCreateRole() {
  const name = newRoleName.value.trim()
  const powerLevelRaw = newRolePowerLevel.value
  const powerLevel =
    typeof powerLevelRaw === 'number'
      ? powerLevelRaw
      : Number.parseInt(String(powerLevelRaw), 10)
  if (!name || !Number.isFinite(powerLevel)) {
    return
  }
  await addRole(name, powerLevel, childRoomIds.value)
  newRoleName.value = ''
  newRolePowerLevel.value = ''
  reloadFromRoom()
}

const canSubmitNewRole = computed(() => {
  const name = newRoleName.value.trim()
  const powerLevelRaw = newRolePowerLevel.value
  const powerLevel =
    typeof powerLevelRaw === 'number'
      ? powerLevelRaw
      : Number.parseInt(String(powerLevelRaw), 10)
  return Boolean(name) && Number.isFinite(powerLevel)
})

const spaceMembersForAssign = computed(() => {
  const matrixClient = client.value
  const room = matrixClient?.getRoom(spaceId.value)
  if (!room) {
    return []
  }
  return room
    .getMembers()
    .filter((member) => member.membership === 'join' && member.userId)
    .map((member) => ({
      userId: member.userId!,
      name: member.name || member.userId!,
    }))
})

function isMemberFounder(memberUserId: string): boolean {
  return isSpaceRoomFounder(client.value, spaceId.value, memberUserId)
}

const spaceFounder = computed(() => {
  const matrixClient = client.value
  const ownerUserId = rolesContent.value?.ownerUserId
  if (!matrixClient || !ownerUserId || !spaceId.value) {
    return null
  }
  if (!isSpaceRoomFounder(matrixClient, spaceId.value, ownerUserId)) {
    return null
  }
  const member = matrixClient.getRoom(spaceId.value)?.getMember(ownerUserId)
  return {
    userId: ownerUserId,
    name: member?.name || ownerUserId,
  }
})

const navItems = computed(() => [
  { id: 'general' as const, label: translateText('settings.spaceNavGeneral') },
  { id: 'roles' as const, label: translateText('settings.spaceNavRoles') },
  { id: 'members' as const, label: translateText('settings.spaceNavMembers') },
])

const spaceAccessOptions = computed(() => [
  {
    value: JoinRule.Public,
    label: translateText('settings.spaceAccessPublic'),
  },
  {
    value: JoinRule.Invite,
    label: translateText('settings.spaceAccessInvite'),
  },
  {
    value: JoinRule.Knock,
    label: translateText('settings.spaceAccessKnock'),
  },
])

async function onJoinRuleChange(event: Event) {
  const nextRule = (event.target as HTMLSelectElement).value as JoinRule
  await saveJoinRule(nextRule)
}

async function onPublishDirectoryChange(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  await setPublishToDirectory(enabled)
}
</script>

<template>
  <div
    class="decentra-shell mx-auto flex min-h-screen w-full max-w-5xl gap-4 p-4"
  >
    <aside
      class="w-52 shrink-0 rounded-xl border border-gray-200 bg-white p-3
             dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="mb-3 text-xs font-semibold uppercase text-gray-500">
        {{ translateText('settings.spaceTitle') }}
      </p>
      <nav class="space-y-1">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="w-full rounded-lg px-3 py-2 text-left text-sm transition"
          :class="activeSection === item.id
            ? 'bg-primary-500/15 text-primary-500'
            : `text-gray-700 hover:bg-gray-100 dark:text-gray-200
               dark:hover:bg-gray-800`"
          @click="activeSection = item.id"
        >
          {{ item.label }}
        </button>
      </nav>
      <UButton
        class="mt-4 w-full"
        color="neutral"
        variant="soft"
        to="/chat"
      >
        {{ translateText('settings.backToChat') }}
      </UButton>
    </aside>

    <main
      class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-6
             dark:border-gray-800 dark:bg-gray-900"
    >
      <UAlert
        v-if="feedbackTitle"
        class="mb-4"
        :color="feedbackTone === 'success' ? 'success' : 'error'"
        :title="feedbackTitle"
      />
      <UAlert
        v-if="saveError"
        class="mb-4"
        color="error"
        :title="saveError"
      />

      <section v-if="activeSection === 'general'" class="space-y-8">
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.spaceNavGeneral') }}
        </h1>

        <div class="space-y-3">
          <h2 class="text-sm font-semibold">
            {{ translateText('settings.spaceGeneralProfile') }}
          </h2>
          <div
            v-if="!isProfileEditing"
            class="flex flex-wrap items-center justify-between gap-4
                   rounded-lg border border-gray-200 p-4
                   dark:border-gray-800"
          >
            <div class="flex min-w-0 items-center gap-3">
              <img
                v-if="avatarPreviewUrl"
                :src="avatarPreviewUrl"
                alt=""
                class="size-14 shrink-0 rounded-xl object-cover"
              >
              <div
                v-else
                class="flex size-14 shrink-0 items-center justify-center
                       rounded-xl bg-gray-200 text-lg font-semibold
                       dark:bg-gray-800"
              >
                {{ displayName.slice(0, 1) || '?' }}
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium">{{ displayName }}</p>
                <p
                  class="truncate text-sm text-gray-500 dark:text-gray-400"
                >
                  {{ displayTopic || '—' }}
                </p>
              </div>
            </div>
            <UButton
              v-if="canManageGeneral"
              size="sm"
              variant="soft"
              @click="startProfileEdit"
            >
              {{ translateText('settings.spaceGeneralProfileEdit') }}
            </UButton>
          </div>
          <div v-else class="space-y-4 rounded-lg border border-gray-200 p-4
                             dark:border-gray-800">
            <label class="flex flex-col gap-2 text-sm">
              <span>{{ translateText('settings.spaceName') }}</span>
              <UInput
                v-model="editableName"
                :disabled="!permissions.name || isSaving"
              />
            </label>
            <label class="flex flex-col gap-2 text-sm">
              <span>{{ translateText('settings.spaceTopic') }}</span>
              <UTextarea
                v-model="editableTopic"
                :disabled="!permissions.topic || isSaving"
                :rows="3"
              />
            </label>
            <div class="flex flex-col gap-2 text-sm">
              <span>{{ translateText('settings.spaceAvatar') }}</span>
              <input
                type="file"
                accept="image/*"
                :disabled="!permissions.avatar || isSaving"
                @change="onAvatarSelected"
              >
              <UButton
                v-if="permissions.avatar"
                size="xs"
                color="neutral"
                variant="soft"
                :disabled="isSaving"
                @click="clearAvatar"
              >
                {{ translateText('settings.spaceAvatarRemove') }}
              </UButton>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="primary"
                :disabled="isSaving"
                :loading="isSaving"
                @click="handleSaveProfile"
              >
                {{ translateText('settings.save') }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                :disabled="isSaving"
                @click="cancelProfileEdit"
              >
                {{ translateText('settings.cancel') }}
              </UButton>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h2 class="text-sm font-semibold">
            {{ translateText('settings.spaceGeneralOptions') }}
          </h2>
          <div
            class="space-y-4 rounded-lg border border-gray-200 p-4
                   dark:border-gray-800"
          >
            <label
              class="flex flex-col gap-2 text-sm sm:flex-row
                     sm:items-center sm:justify-between"
            >
              <span>
                <span class="font-medium">
                  {{ translateText('settings.spaceAccess') }}
                </span>
                <span
                  class="mt-1 block text-xs text-gray-500
                         dark:text-gray-400"
                >
                  {{ translateText('settings.spaceAccessHint') }}
                </span>
              </span>
              <select
                class="rounded border border-gray-300 bg-white px-2 py-1
                       text-sm dark:border-gray-700 dark:bg-gray-900"
                :disabled="!canManageGeneral || isSavingOptions"
                :value="joinRule"
                @change="onJoinRuleChange"
              >
                <option
                  v-for="option in spaceAccessOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label
              class="flex flex-col gap-2 text-sm sm:flex-row
                     sm:items-center sm:justify-between"
            >
              <span>
                <span class="font-medium">
                  {{ translateText('settings.spacePublishDirectory') }}
                </span>
                <span
                  class="mt-1 block text-xs text-gray-500
                         dark:text-gray-400"
                >
                  {{ translateText('settings.spacePublishDirectoryHint') }}
                </span>
              </span>
              <input
                type="checkbox"
                class="size-4"
                :checked="publishToDirectory"
                :disabled="!canManageGeneral || isSavingOptions"
                @change="onPublishDirectoryChange"
              >
            </label>
          </div>
        </div>

        <div class="space-y-3">
          <h2 class="text-sm font-semibold">
            {{ translateText('settings.spaceGeneralAddresses') }}
          </h2>
          <div
            class="space-y-4 rounded-lg border border-gray-200 p-4
                   dark:border-gray-800"
          >
            <div>
              <p class="text-sm font-medium">
                {{ translateText('settings.spacePublishedAddresses') }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ translateText('settings.spacePublishedAddressesHint') }}
              </p>
              <div
                v-if="publishedAddresses.canonical"
                class="mt-2 flex flex-wrap items-center gap-2 rounded
                       bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60"
              >
                <code class="break-all">
                  {{ publishedAddresses.canonical }}
                </code>
                <span
                  class="rounded bg-primary-500/15 px-2 py-0.5 text-xs
                         text-primary-500"
                >
                  {{ translateText('settings.spaceMainAlias') }}
                </span>
              </div>
              <p
                v-else
                class="mt-2 text-sm text-gray-500 dark:text-gray-400"
              >
                {{ translateText('settings.spaceNoPublishedAddress') }}
              </p>
            </div>
            <div>
              <div
                class="flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p class="text-sm font-medium">
                    {{ translateText('settings.spaceLocalAddresses') }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ translateText('settings.spaceLocalAddressesHint') }}
                  </p>
                </div>
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  @click="localAddressesExpanded = !localAddressesExpanded"
                >
                  {{
                    localAddressesExpanded
                      ? translateText('settings.spaceCollapse')
                      : translateText('settings.spaceExpand')
                  }}
                </UButton>
              </div>
              <ul
                v-if="localAddressesExpanded"
                class="mt-2 space-y-1 text-sm"
              >
                <li>
                  <code class="break-all">{{ spaceId }}</code>
                </li>
                <li
                  v-for="alias in publishedAddresses.alternatives"
                  :key="alias"
                >
                  <code class="break-all">{{ alias }}</code>
                </li>
                <li
                  v-if="publishedAddresses.alternatives.length === 0"
                  class="text-gray-500 dark:text-gray-400"
                >
                  —
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h2 class="text-sm font-semibold">
            {{ translateText('settings.spaceGeneralAdvanced') }}
          </h2>
          <div
            class="flex flex-wrap items-center justify-between gap-4
                   rounded-lg border border-gray-200 p-4
                   dark:border-gray-800"
          >
            <div>
              <p class="text-sm font-medium">
                {{ translateText('settings.spaceUpgrade') }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{
                  translateText('settings.spaceUpgradeHint', {
                    version: roomVersionLabel || '—',
                  })
                }}
              </p>
              <p
                v-if="recommendedVersion?.needsUpgrade"
                class="mt-1 text-xs text-amber-600 dark:text-amber-400"
              >
                {{
                  translateText('settings.spaceUpgradeAvailable', {
                    version: recommendedVersion.version,
                  })
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="sm"
                variant="soft"
                color="neutral"
                disabled
              >
                {{ translateText('settings.spaceOldSpace') }}
              </UButton>
              <UButton
                size="sm"
                color="primary"
                :disabled="!recommendedVersion?.needsUpgrade
                  || !canManageGeneral
                  || isUpgrading"
                :loading="isUpgrading"
                @click="runSpaceUpgrade"
              >
                {{ translateText('settings.spaceUpgradeButton') }}
              </UButton>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="activeSection === 'roles'" class="space-y-4">
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.spaceNavRoles') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('settings.spaceRolesHint') }}
        </p>
        <div
          v-if="spaceFounder"
          class="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
        >
          <h2 class="text-sm font-semibold">
            {{ translateText('settings.spaceFoundersTitle') }}
          </h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ translateText('settings.spaceFoundersHint') }}
          </p>
          <p class="mt-2 text-sm">{{ spaceFounder.name }}</p>
        </div>
        <div
          v-if="canEditRoles"
          class="flex flex-wrap items-end gap-2"
        >
          <UInput
            v-model="newRoleName"
            class="min-w-[10rem] flex-1"
            :placeholder="translateText('settings.spaceRoleNamePlaceholder')"
          />
          <UInput
            v-model.number="newRolePowerLevel"
            type="number"
            class="w-28"
            min="-100"
            max="1000"
            step="1"
            :placeholder="translateText('settings.spaceRolePowerLevel')"
          />
          <UButton
            color="primary"
            :disabled="!canSubmitNewRole"
            @click="handleCreateRole"
          >
            {{ translateText('settings.spaceRoleCreate') }}
          </UButton>
        </div>
        <p
          v-if="canEditRoles"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ translateText('settings.spaceRolesDragHint') }}
        </p>
        <UAlert
          v-if="roleSaveTitle"
          class="mb-2"
          color="success"
          :title="roleSaveTitle"
        />
        <VueDraggable
          v-model="localRolesForDrag"
          :disabled="!canEditRoles || editingRoleId !== null"
          :animation="150"
          handle=".decentra-role-drag-handle"
          filter=".decentra-role-interactive"
          :prevent-on-filter="true"
          class="space-y-3"
          @end="onRoleDragEnd"
        >
          <div
            v-for="role in localRolesForDrag"
            :key="role.id"
            class="rounded-lg border border-gray-200 p-3
                   dark:border-gray-800"
          >
            <div class="flex items-center gap-2">
              <span
                v-if="canEditRoles && !role.isEveryone"
                class="decentra-role-drag-handle cursor-grab px-1
                       text-gray-400 active:cursor-grabbing"
                aria-hidden="true"
              >⋮⋮</span>
              <span
                class="size-3 rounded-full"
                :style="{ backgroundColor: role.color }"
              />
              <span class="font-medium">{{ role.name }}</span>
              <span class="text-xs text-gray-500">
                PL {{ role.powerLevel }}
              </span>
            </div>
            <div
              v-if="editingRoleId === role.id && roleEditDraft"
              class="decentra-role-interactive mt-3 space-y-3"
            >
              <label class="flex flex-col gap-1 text-sm">
                <span>{{ translateText('settings.spaceRoleNameLabel') }}</span>
                <UInput
                  v-model="roleEditDraft.name"
                  :disabled="isSavingRole"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span>{{ translateText('settings.spaceRolePowerLevel') }}</span>
                <UInput
                  v-model.number="roleEditDraft.powerLevel"
                  type="number"
                  min="-100"
                  max="1000"
                  step="1"
                  :disabled="isSavingRole"
                />
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="roleEditDraft.color"
                  type="color"
                  class="decentra-role-interactive"
                  :disabled="isSavingRole"
                >
                {{ translateText('settings.spaceRoleColor') }}
              </label>
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="primary"
                  size="sm"
                  :disabled="isSavingRole"
                  :loading="isSavingRole"
                  @click="handleSaveRoleEdits"
                >
                  {{ translateText('settings.save') }}
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  :disabled="isSavingRole"
                  @click="cancelEditRole"
                >
                  {{ translateText('settings.cancel') }}
                </UButton>
              </div>
            </div>
            <div
              v-else
              class="decentra-role-interactive mt-2 flex gap-2"
            >
              <UButton
                v-if="canEditRoles"
                size="xs"
                variant="soft"
                @click="startEditRole(role)"
              >
                {{ translateText('settings.spaceRoleEdit') }}
              </UButton>
              <UButton
                v-if="!role.isEveryone && canEditRoles"
                size="xs"
                color="error"
                variant="soft"
                @click="deleteRole(role.id, childRoomIds)"
              >
                {{ translateText('settings.spaceRoleDelete') }}
              </UButton>
            </div>
          </div>
        </VueDraggable>
        <div
          v-if="canEditRoles"
          class="mt-8 space-y-6 rounded-lg border border-gray-200 p-4
                 dark:border-gray-800"
        >
          <h2 class="text-lg font-semibold">
            {{ translateText('settings.spacePlPermissionsTitle') }}
          </h2>
          <section
            v-for="group in permissionGroups"
            :key="group.id"
            class="space-y-3"
          >
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {{ translateText(group.labelKey) }}
            </h3>
            <div class="space-y-2">
              <div
                v-for="field in group.fields"
                :key="field.id"
                class="flex flex-col gap-2 rounded-lg bg-gray-50 px-3 py-2
                       text-sm sm:flex-row sm:items-center sm:justify-between
                       dark:bg-gray-800/50"
              >
                <span>{{ translateText(field.labelKey) }}</span>
                <SettingsSpacePermissionRoleSelect
                  :model-value="readFieldValue(field)"
                  :roles="sortedRoles"
                  :show-and-above="field.showAndAbove !== false"
                  :disabled="isSavingPermissions"
                  @update:model-value="onPermissionFieldChange(
                    field.id,
                    $event,
                  )"
                />
              </div>
            </div>
          </section>
        </div>
      </section>

      <section v-else class="space-y-4">
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.spaceNavMembers') }}
        </h1>
        <ul
          v-if="rolesContent"
          class="space-y-2"
        >
          <li
            v-for="member in spaceMembersForAssign"
            :key="member.userId"
            class="flex flex-wrap items-center justify-between gap-2
                   rounded-lg border border-gray-200 px-3 py-2
                   dark:border-gray-800"
          >
            <span class="text-sm">{{ member.name }}</span>
            <span
              v-if="isMemberFounder(member.userId)"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              {{ translateText('settings.spaceRoleFounder') }}
            </span>
            <select
              v-else
              class="rounded border border-gray-300 bg-white px-2 py-1
                     text-sm dark:border-gray-700 dark:bg-gray-900"
              :disabled="!canEditRoles"
              :value="rolesContent.assignments[member.userId]
                ?? rolesContent.everyoneRoleId"
              @change="assignUserRole(
                member.userId,
                ($event.target as HTMLSelectElement).value,
                childRoomIds,
              )"
            >
              <option
                v-for="role in sortedRoles"
                :key="role.id"
                :value="role.id"
              >
                {{ role.name }}
              </option>
            </select>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
