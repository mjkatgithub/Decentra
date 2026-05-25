<script setup lang="ts">
import { useAppI18n } from '~/composables/useAppI18n'
import type { SpaceRoleDefinition } from '~/utils/decentraSpaceRoles'
import {
  formatPermissionThresholdLabel,
  resolveRoleForRequiredPowerLevel,
  rolesForPermissionDropdown,
} from '~/utils/spacePermissionRoleDisplay'

const props = withDefaults(
  defineProps<{
    modelValue: number
    roles: SpaceRoleDefinition[]
    showAndAbove?: boolean
    disabled?: boolean
  }>(),
  {
    showAndAbove: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [powerLevel: number]
}>()

const { translateText } = useAppI18n()
const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const dropdownRoles = computed(() =>
  rolesForPermissionDropdown(props.roles),
)

const selectedRole = computed(() =>
  resolveRoleForRequiredPowerLevel(props.roles, props.modelValue),
)

const closedLabel = computed(() => {
  const role = selectedRole.value
  if (!role) {
    return String(props.modelValue)
  }
  return formatPermissionThresholdLabel(
    role,
    props.showAndAbove,
    (roleName) =>
      translateText('settings.spacePlRoleAndAbove', { name: roleName }),
  )
})

function toggleOpen() {
  if (props.disabled) {
    return
  }
  isOpen.value = !isOpen.value
}

function selectRole(role: SpaceRoleDefinition) {
  emit('update:modelValue', role.powerLevel)
  isOpen.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div ref="rootRef" class="relative min-w-[11rem]">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded
             border border-gray-300 bg-white px-2 py-1.5 text-sm
             dark:border-gray-700 dark:bg-gray-900"
      :disabled="disabled"
      @click.stop="toggleOpen"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span
          v-if="selectedRole"
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: selectedRole.color }"
        />
        <span class="truncate">{{ closedLabel }}</span>
      </span>
      <span class="text-gray-400" aria-hidden="true">▾</span>
    </button>
    <ul
      v-if="isOpen"
      class="absolute right-0 z-20 mt-1 max-h-60 w-full min-w-[14rem]
             overflow-y-auto rounded border border-gray-300 bg-white py-1
             shadow-lg dark:border-gray-700 dark:bg-gray-900"
      @click.stop
    >
      <li
        v-for="role in dropdownRoles"
        :key="role.id"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                 hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="{
            'bg-gray-100 dark:bg-gray-800':
              role.powerLevel === modelValue,
          }"
          @click="selectRole(role)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: role.color }"
          />
          <span class="min-w-0 flex-1 truncate">{{ role.name }}</span>
          <span class="shrink-0 tabular-nums text-gray-500
                       dark:text-gray-400">
            {{ role.powerLevel }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
