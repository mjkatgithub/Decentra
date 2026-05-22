<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useAppI18n } from '~/composables/useAppI18n'
import type { ThreadNavEntry } from '~/utils/chatTimeline'

interface RoomItem {
  roomId: string
  name: string
  hasUnread?: boolean
}

interface RoomSectionItem {
  id: string
  name: string
  kind?: 'root' | 'subspace'
  subspaceRoomId?: string
  rootChildAnchorIds?: string[]
  canReorderRooms: boolean
  rooms: RoomItem[]
}

const props = defineProps<{
  selectedSpaceName: string
  categories: RoomSectionItem[]
  selectedRoomId: string | null
  /** Reorder category blocks (m.space.child on root) — power-level gated */
  canReorderCategories: boolean
  /** When null (e.g. Home), hierarchy DnD is off */
  selectedRootSpaceId: string | null
  threadsByRoomId?: Record<string, ThreadNavEntry[]>
  activeThreadRootId?: string | null
  /** Room id when a thread is open in the main pane (exclusive nav selection) */
  activeMainThreadRoomId?: string | null
}>()

const emit = defineEmits<{
  selectRoom: [roomId: string]
  selectThread: [payload: { roomId: string; rootEventId: string }]
  openSpaceSettings: []
  persistRoomOrder: [
    payload: { parentSpaceId: string; orderedRoomIds: string[] },
  ]
  moveRoomBetweenCategories: [
    payload: {
      roomId: string
      previousParentSpaceId: string
      nextParentSpaceId: string
      insertIndex: number
    },
  ]
  reorderRootCategories: [orderedRootChildIds: string[]]
}>()

const { translateText } = useAppI18n()

const localCategories = ref<RoomSectionItem[]>([])
/** Collapsed category ids (default: all expanded) */
const collapsedCategoryIds = ref<Set<string>>(new Set())

const categoryDragEnabled = computed(
  () => Boolean(props.selectedRootSpaceId) && props.canReorderCategories,
)

const sortableDragOptions = {
  ghostClass: 'decentra-drag-ghost',
  chosenClass: 'decentra-drag-chosen',
  animation: 150,
}

function markSortableDropTarget(event: { to?: HTMLElement | null }) {
  document
    .querySelectorAll('.decentra-sortable-drop-target')
    .forEach((element) => {
      element.classList.remove('decentra-sortable-drop-target')
    })
  event.to?.classList.add('decentra-sortable-drop-target')
}

function clearSortableDropTargets() {
  document
    .querySelectorAll('.decentra-sortable-drop-target')
    .forEach((element) => {
      element.classList.remove('decentra-sortable-drop-target')
    })
}

function onSortableMove(event: { to?: HTMLElement | null }): boolean {
  markSortableDropTarget(event)
  return true
}

watch(
  () => props.categories,
  (nextCategories) => {
    localCategories.value = nextCategories.map((category) => ({
      ...category,
      rooms: [...category.rooms],
      rootChildAnchorIds: category.rootChildAnchorIds
        ? [...category.rootChildAnchorIds]
        : [],
    }))
  },
  { deep: true, immediate: true },
)

function isCategoryCollapsed(categoryId: string): boolean {
  return collapsedCategoryIds.value.has(categoryId)
}

function toggleCategoryCollapsed(categoryId: string) {
  const next = new Set(collapsedCategoryIds.value)
  if (next.has(categoryId)) {
    next.delete(categoryId)
  } else {
    next.add(categoryId)
  }
  collapsedCategoryIds.value = next
}

function parentSpaceIdFor(category: RoomSectionItem): string {
  if (category.kind === 'subspace' && category.subspaceRoomId) {
    return category.subspaceRoomId
  }
  return props.selectedRootSpaceId ?? ''
}

function roomListDragEnabled(category: RoomSectionItem): boolean {
  return Boolean(props.selectedRootSpaceId) && category.canReorderRooms
}

function selectRoom(roomId: string) {
  emit('selectRoom', roomId)
}

function selectThread(roomId: string, rootEventId: string) {
  emit('selectThread', { roomId, rootEventId })
}

function roomNavAriaLabel(room: RoomItem): string {
  if (room.hasUnread) {
    return translateText('layout.channelUnreadAria', { name: room.name })
  }
  return room.name
}

function isRoomNavSelected(roomId: string): boolean {
  if (props.selectedRoomId !== roomId) {
    return false
  }
  if (
    props.activeMainThreadRoomId === roomId &&
    props.activeThreadRootId
  ) {
    return false
  }
  return true
}

function isThreadNavSelected(rootEventId: string, roomId: string): boolean {
  return (
    props.activeThreadRootId === rootEventId &&
    props.activeMainThreadRoomId === roomId
  )
}

/**
 * Identify which category a Sortable list element belongs to (VueDraggable
 * root does not receive our data-attrs). Empty lists use a sentinel node.
 */
function categoryIdFromRoomListEl(
  listElement: HTMLElement | null | undefined,
): string {
  if (!listElement) {
    return ''
  }
  const emptyMarker = listElement.querySelector('[data-category-empty]')
  const emptyId = emptyMarker?.getAttribute('data-category-empty')
  if (emptyId) {
    return emptyId
  }
  const firstRoomButton = listElement.querySelector(
    '[data-room-id]',
  ) as HTMLElement | null
  const roomId = firstRoomButton?.dataset?.roomId
  if (!roomId) {
    return ''
  }
  const category = localCategories.value.find((entry) =>
    entry.rooms.some((room) => room.roomId === roomId),
  )
  return category?.id ?? ''
}

/**
 * Block cross-list moves unless both parents allow m.space.child.
 */
function onRoomSortableMove(event: {
  from?: HTMLElement
  to?: HTMLElement
}): boolean {
  markSortableDropTarget(event)
  if (!props.selectedRootSpaceId) {
    return false
  }
  const fromId = categoryIdFromRoomListEl(event.from ?? null)
  const toId = categoryIdFromRoomListEl(event.to ?? null)
  const fromCategory = localCategories.value.find(
    (entry) => entry.id === fromId,
  )
  const toCategory = localCategories.value.find((entry) => entry.id === toId)
  if (!fromCategory || !toCategory) {
    return false
  }
  if (!fromCategory.canReorderRooms || !toCategory.canReorderRooms) {
    return false
  }
  return true
}

function onCategoryDragEnd() {
  clearSortableDropTargets()
  if (!categoryDragEnabled.value || !props.selectedRootSpaceId) {
    return
  }
  const previousIds = props.categories.map((category) => category.id).join(',')
  const nextIds = localCategories.value.map((category) => category.id).join(',')
  if (previousIds === nextIds) {
    return
  }
  const orderedRootChildIds = localCategories.value.flatMap(
    (category) => category.rootChildAnchorIds ?? [],
  )
  emit('reorderRootCategories', orderedRootChildIds)
}

const spaceHeaderMenuItems = computed(() => [
  [
    {
      label: translateText('layout.openSpaceSettings'),
      icon: 'i-lucide-settings-2',
      onSelect: () => emit('openSpaceSettings'),
    },
  ],
])

function onRoomDragEnd(_category: RoomSectionItem, rawEvent: unknown) {
  clearSortableDropTargets()
  if (!props.selectedRootSpaceId) {
    return
  }
  const event = rawEvent as {
    from: HTMLElement
    to: HTMLElement
    oldIndex: number
    newIndex: number
    item?: HTMLElement
  }
  if (event.oldIndex === event.newIndex && event.from === event.to) {
    return
  }

  const fromCategoryId = categoryIdFromRoomListEl(event.from)
  const toCategoryId = categoryIdFromRoomListEl(event.to)

  const fromCategory = localCategories.value.find(
    (entry) => entry.id === fromCategoryId,
  )
  const toCategory = localCategories.value.find(
    (entry) => entry.id === toCategoryId,
  )

  if (!fromCategory || !toCategory) {
    return
  }
  if (!fromCategory.canReorderRooms || !toCategory.canReorderRooms) {
    return
  }

  const roomIdFromDom = event.item?.dataset?.roomId
  const roomId =
    typeof roomIdFromDom === 'string' && roomIdFromDom.length > 0
      ? roomIdFromDom
      : toCategory.rooms[event.newIndex]?.roomId

  if (!roomId) {
    return
  }

  const previousParentSpaceId = parentSpaceIdFor(fromCategory)
  const nextParentSpaceId = parentSpaceIdFor(toCategory)

  if (previousParentSpaceId === nextParentSpaceId) {
    emit('persistRoomOrder', {
      parentSpaceId: previousParentSpaceId,
      orderedRoomIds: toCategory.rooms.map((room) => room.roomId),
    })
    return
  }

  emit('moveRoomBetweenCategories', {
    roomId,
    previousParentSpaceId,
    nextParentSpaceId,
    insertIndex: event.newIndex,
  })
}
</script>

<template>
  <section
    class="flex h-full w-72 flex-col border-r border-gray-200 bg-white
           dark:border-gray-800 dark:bg-gray-900"
  >
    <header
      class="flex items-center justify-between gap-2 border-b border-gray-200
             px-3 py-2 dark:border-gray-800"
    >
      <div class="min-w-0 flex-1">
        <p
          class="text-xs font-semibold uppercase tracking-wide text-gray-500
                 dark:text-gray-400"
        >
          {{ translateText('layout.channels') }}
        </p>
        <UDropdownMenu
          v-if="selectedRootSpaceId"
          :items="spaceHeaderMenuItems"
        >
          <button
            type="button"
            class="flex max-w-full items-center gap-1 rounded-md px-0.5 py-0.5
                   text-left text-sm font-semibold text-gray-800 transition
                   hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <span class="truncate">{{ selectedSpaceName }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 text-gray-500 dark:text-gray-400"
            />
          </button>
        </UDropdownMenu>
        <p
          v-else
          class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100"
        >
          {{ selectedSpaceName }}
        </p>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-2 py-3">
      <template v-if="localCategories.length === 0">
        <p class="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
          {{ translateText('layout.noRoomsInSpace') }}
        </p>
      </template>
      <VueDraggable
        v-else
        v-model="localCategories"
        :disabled="!categoryDragEnabled"
        :filter="categoryDragEnabled ? '.decentra-category-no-drag' : undefined"
        :prevent-on-filter="true"
        v-bind="sortableDragOptions"
        class="space-y-4"
        @move="onSortableMove"
        @end="onCategoryDragEnd"
      >
        <div
          v-for="category in localCategories"
          :key="category.id"
          class="mb-4"
          :class="categoryDragEnabled
            ? 'touch-none select-none active:cursor-grabbing'
            : ''"
        >
          <div
            class="flex items-center gap-1 pr-2 pl-0 pb-1"
          >
            <button
              type="button"
              class="decentra-category-no-drag shrink-0 rounded p-0.5
                     text-gray-500 transition hover:bg-gray-100
                     dark:text-gray-400 dark:hover:bg-gray-800"
              :aria-expanded="!isCategoryCollapsed(category.id)"
              :aria-label="isCategoryCollapsed(category.id)
                ? translateText('layout.expandCategory')
                : translateText('layout.collapseCategory')"
              @click.stop="toggleCategoryCollapsed(category.id)"
            >
              <span
                class="block w-4 text-center text-xs font-semibold leading-none
                       transition-transform duration-150"
                :class="isCategoryCollapsed(category.id) ? '' : 'rotate-90'"
              >></span>
            </button>
            <p
              class="min-w-0 flex-1 text-xs font-semibold uppercase
                     tracking-wide text-gray-500 dark:text-gray-400"
            >
              {{ category.name }}
            </p>
          </div>
          <div
            v-show="!isCategoryCollapsed(category.id)"
            class="space-y-1"
          >
            <VueDraggable
              v-model="category.rooms"
              group="decentra-space-channels"
              :disabled="!roomListDragEnabled(category)"
              :delay="200"
              :delay-on-touch-only="true"
              :filter="'.decentra-channel-no-drag'"
              :prevent-on-filter="true"
              v-bind="sortableDragOptions"
              class="space-y-1"
              @move="onRoomSortableMove"
              @end="(event: unknown) => onRoomDragEnd(category, event as {
                from: HTMLElement
                to: HTMLElement
                oldIndex: number
                newIndex: number
                item?: HTMLElement
              })"
            >
              <div
                v-for="room in category.rooms"
                :key="room.roomId"
                class="space-y-0.5"
              >
                <button
                  type="button"
                  class="decentra-channel-row flex w-full items-center
                         justify-between gap-2 rounded-lg py-2 pr-2 pl-[14px]
                         text-left text-sm transition"
                  :class="isRoomNavSelected(room.roomId)
                    ? 'bg-primary-500/15 text-primary-500'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'"
                  :data-room-id="room.roomId"
                  :data-unread="room.hasUnread ? 'true' : 'false'"
                  :aria-label="roomNavAriaLabel(room)"
                  @click="selectRoom(room.roomId)"
                >
                  <span
                    class="min-w-0 truncate"
                    :class="room.hasUnread ? 'font-semibold' : ''"
                  >
                    # {{ room.name }}
                  </span>
                  <span
                    v-if="room.hasUnread"
                    class="size-2 shrink-0 rounded-full bg-primary-500"
                    aria-hidden="true"
                  />
                </button>
                <button
                  v-for="thread in (
                    props.threadsByRoomId?.[room.roomId] ?? []
                  )"
                  :key="thread.rootEventId"
                  type="button"
                  class="decentra-channel-no-drag flex w-full items-center gap-2
                         rounded-lg py-1.5 pr-2 pl-6 text-left text-sm transition"
                  :class="isThreadNavSelected(thread.rootEventId, room.roomId)
                    ? 'bg-primary-500/15 text-primary-500'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'"
                  @click.stop="selectThread(room.roomId, thread.rootEventId)"
                >
                  <UIcon
                    name="i-lucide-messages-square"
                    class="size-4 shrink-0 opacity-80"
                  />
                  <span class="min-w-0 truncate">{{ thread.title }}</span>
                </button>
              </div>
              <div
                v-if="category.rooms.length === 0"
                :data-category-empty="category.id"
                class="pointer-events-none h-px w-full opacity-0"
                aria-hidden="true"
              />
            </VueDraggable>
          </div>
        </div>
      </VueDraggable>
    </div>
  </section>
</template>
