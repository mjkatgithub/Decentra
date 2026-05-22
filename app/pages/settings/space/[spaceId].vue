<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useAppI18n } from '~/composables/useAppI18n'
import { useMatrixClient } from '~/composables/useMatrixClient'
import { useSpaceRoles } from '~/composables/useSpaceRoles'
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
  updateRole,
  deleteRole,
  reorderRoles,
  assignUserRole,
  canManageRoles,
  ensureInitialRoles,
  reloadFromRoom,
  rolesContent,
} = useSpaceRoles(spaceId)

const newRoleName = ref('')
const avatarFile = ref<File | null>(null)
const editingRoleId = ref<string | null>(null)
const localRolesForDrag = ref<SpaceRoleDefinition[]>([])

watch(
  sortedRoles,
  (roles) => {
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
    generalCategoryLabel: translateText('layout.generalCategory'),
  })
  const roomIds = new Set<string>()
  for (const category of built) {
    for (const room of category.rooms) {
      roomIds.add(room.roomId)
    }
  }
  return [...roomIds]
})

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
  if (!name) {
    return
  }
  await addRole(name, childRoomIds.value)
  newRoleName.value = ''
  reloadFromRoom()
}

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
            class="min-w-[12rem] flex-1"
            :placeholder="translateText('settings.spaceRoleNamePlaceholder')"
          />
          <UButton color="primary" @click="handleCreateRole">
            {{ translateText('settings.spaceRoleCreate') }}
          </UButton>
        </div>
        <p
          v-if="canManageRoles()"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ translateText('settings.spaceRolesDragHint') }}
        </p>
        <VueDraggable
          v-model="localRolesForDrag"
          :disabled="!canManageRoles()"
          :animation="150"
          handle=".decentra-role-drag-handle"
          class="space-y-3"
          @end="onRoleDragEnd"
        >
          <li
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
              v-if="editingRoleId === role.id"
              class="mt-3 space-y-2"
            >
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  :value="role.color"
                  @input="updateRole(role.id, {
                    color: ($event.target as HTMLInputElement).value,
                  }, childRoomIds)"
                >
                {{ translateText('settings.spaceRoleColor') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="role.permissions.manageRoles"
                  @change="updateRole(role.id, {
                    permissions: {
                      ...role.permissions,
                      manageRoles: ($event.target as HTMLInputElement)
                        .checked,
                    },
                  }, childRoomIds)"
                >
                {{ translateText('settings.spacePermManageRoles') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="role.permissions.redactOthers"
                  @change="updateRole(role.id, {
                    permissions: {
                      ...role.permissions,
                      redactOthers: ($event.target as HTMLInputElement)
                        .checked,
                    },
                  }, childRoomIds)"
                >
                {{ translateText('settings.spacePermRedact') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="role.permissions.reorderChannels"
                  @change="updateRole(role.id, {
                    permissions: {
                      ...role.permissions,
                      reorderChannels: ($event.target as HTMLInputElement)
                        .checked,
                    },
                  }, childRoomIds)"
                >
                {{ translateText('settings.spacePermReorder') }}
              </label>
              <p class="text-xs text-gray-500">
                {{ translateText('settings.spaceVisibleRooms') }}:
                {{ role.permissions.visibleRoomIds.length === 0
                  ? translateText('settings.spaceVisibleRoomsAll')
                  : role.permissions.visibleRoomIds.length }}
              </p>
              <div class="flex flex-wrap gap-1">
                <label
                  v-for="roomId in childRoomIds"
                  :key="roomId"
                  class="flex items-center gap-1 rounded border px-2 py-1
                         text-xs dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    :checked="role.permissions.visibleRoomIds.length === 0
                      || role.permissions.visibleRoomIds.includes(roomId)"
                    @change="(event) => {
                      const checked = (event.target as HTMLInputElement)
                        .checked
                      const current = role.permissions.visibleRoomIds
                      let next = current.length === 0
                        ? [...childRoomIds]
                        : [...current]
                      if (checked) {
                        if (!next.includes(roomId)) next.push(roomId)
                      } else {
                        next = next.filter((id) => id !== roomId)
                      }
                      if (next.length === childRoomIds.length) {
                        next = []
                      }
                      updateRole(role.id, {
                        permissions: {
                          ...role.permissions,
                          visibleRoomIds: next,
                        },
                      }, childRoomIds)
                    }"
                  >
                  <span class="max-w-[8rem] truncate">{{ roomId }}</span>
                </label>
              </div>
            </div>
            <div class="mt-2 flex gap-2">
              <UButton
                size="xs"
                variant="soft"
                @click="editingRoleId =
                  editingRoleId === role.id ? null : role.id"
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
          </li>
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
