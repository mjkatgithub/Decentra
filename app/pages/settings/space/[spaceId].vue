<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import {
  useSpaceRoles,
  type SpaceRoleEditDraft,
} from '~/composables/useSpaceRoles'
import { useSpaceSettings } from '~/composables/useSpaceSettings'
import { buildSpaceRoomCategories } from '~/utils/spaceRoomCategories'
import type { SpaceRoleDefinition } from '~/utils/decentraSpaceRoles'

const route = useRoute()
const { translateText } = useAppI18n()
const { client, userId } = useMatrixClient()

const spaceId = computed(() => String(route.params.spaceId || ''))
const activeSection = ref<'profile' | 'roles' | 'members'>('profile')

const {
  editableName,
  editableTopic,
  permissions,
  avatarPreviewUrl,
  feedbackMessage,
  feedbackTone,
  isSaving,
  saveProfile,
  clearAvatar,
  spaceRoom,
} = useSpaceSettings(spaceId)

const {
  sortedRoles,
  saveError,
  addRole,
  saveRoleEdits,
  deleteRole,
  reorderRoles,
  assignUserRole,
  canManageRoles,
  ensureInitialRoles,
  reloadFromRoom,
  rolesContent,
} = useSpaceRoles(spaceId)

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
  if (!canManageRoles()) {
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

function cloneRolePermissions(
  permissions: SpaceRoleDefinition['permissions'],
): SpaceRoleDefinition['permissions'] {
  return {
    ...permissions,
    visibleRoomIds: [...permissions.visibleRoomIds],
  }
}

function startEditRole(role: SpaceRoleDefinition) {
  editingRoleId.value = role.id
  roleEditDraft.value = {
    name: role.name,
    color: role.color,
    powerLevel: role.powerLevel,
    permissions: cloneRolePermissions(role.permissions),
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

function setVisibleRoomChecked(roomId: string, checked: boolean) {
  const draft = roleEditDraft.value
  if (!draft) {
    return
  }
  const current = draft.permissions.visibleRoomIds
  let next =
    current.length === 0 ? [...childRoomIds.value] : [...current]
  if (checked) {
    if (!next.includes(roomId)) {
      next.push(roomId)
    }
  } else {
    next = next.filter((id) => id !== roomId)
  }
  if (next.length === childRoomIds.value.length) {
    next = []
  }
  draft.permissions.visibleRoomIds = next
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

const navItems = computed(() => [
  { id: 'profile' as const, label: translateText('settings.spaceNavProfile') },
  { id: 'roles' as const, label: translateText('settings.spaceNavRoles') },
  { id: 'members' as const, label: translateText('settings.spaceNavMembers') },
])
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

      <section v-if="activeSection === 'profile'" class="space-y-4">
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.spaceNavProfile') }}
        </h1>
        <label class="flex flex-col gap-1 text-sm">
          <span>{{ translateText('settings.spaceId') }}</span>
          <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
            {{ spaceId }}
          </code>
        </label>
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
          <img
            v-if="avatarPreviewUrl"
            :src="avatarPreviewUrl"
            alt=""
            class="size-16 rounded-xl object-cover"
          >
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
        <UButton
          color="primary"
          :disabled="isSaving"
          @click="handleSaveProfile"
        >
          {{ translateText('settings.save') }}
        </UButton>
      </section>

      <section v-else-if="activeSection === 'roles'" class="space-y-4">
        <h1 class="text-xl font-semibold">
          {{ translateText('settings.spaceNavRoles') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('settings.spaceRolesHint') }}
        </p>
        <div
          v-if="canManageRoles()"
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
          v-if="canManageRoles()"
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
          :disabled="!canManageRoles() || editingRoleId !== null"
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
                v-if="canManageRoles() && !role.isEveryone"
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
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="roleEditDraft.permissions.manageRoles"
                  type="checkbox"
                  class="decentra-role-interactive"
                  :disabled="isSavingRole"
                >
                {{ translateText('settings.spacePermManageRoles') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="roleEditDraft.permissions.redactOthers"
                  type="checkbox"
                  class="decentra-role-interactive"
                  :disabled="isSavingRole"
                >
                {{ translateText('settings.spacePermRedact') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="roleEditDraft.permissions.reorderChannels"
                  type="checkbox"
                  class="decentra-role-interactive"
                  :disabled="isSavingRole"
                >
                {{ translateText('settings.spacePermReorder') }}
              </label>
              <p class="text-xs text-gray-500">
                {{ translateText('settings.spaceVisibleRooms') }}:
                {{ roleEditDraft.permissions.visibleRoomIds.length === 0
                  ? translateText('settings.spaceVisibleRoomsAll')
                  : roleEditDraft.permissions.visibleRoomIds.length }}
              </p>
              <div class="flex flex-wrap gap-1">
                <label
                  v-for="room in childRoomEntries"
                  :key="room.roomId"
                  class="decentra-role-interactive flex items-center gap-1
                         rounded border px-2 py-1 text-xs dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    class="decentra-role-interactive"
                    :checked="roleEditDraft.permissions.visibleRoomIds
                        .length === 0
                      || roleEditDraft.permissions.visibleRoomIds
                        .includes(room.roomId)"
                    :disabled="isSavingRole"
                    @change="setVisibleRoomChecked(
                      room.roomId,
                      ($event.target as HTMLInputElement).checked,
                    )"
                  >
                  <span class="max-w-[10rem] truncate">{{ room.name }}</span>
                </label>
              </div>
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
                v-if="canManageRoles()"
                size="xs"
                variant="soft"
                @click="startEditRole(role)"
              >
                {{ translateText('settings.spaceRoleEdit') }}
              </UButton>
              <UButton
                v-if="!role.isEveryone && canManageRoles()"
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
            <select
              class="rounded border border-gray-300 bg-white px-2 py-1
                     text-sm dark:border-gray-700 dark:bg-gray-900"
              :disabled="!canManageRoles()"
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
