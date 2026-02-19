<script setup lang="ts">
import { ClientEvent, MatrixEventEvent, RoomEvent } from "matrix-js-sdk";
import { useAppI18n } from "~/composables/useAppI18n";
import { mapTimelineEventsToMessages } from "~/utils/chatTimeline";

type PresenceStatus = "online" | "away" | "busy" | "offline" | "unknown";

interface ChatMessage {
  id: string;
  kind: "message" | "notice";
  isDecryptionError?: boolean;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  readBy: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }>;
}

interface SpaceItem {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface RoomItem {
  roomId: string;
  name: string;
  parentSpaceIds: string[];
}

interface RoomCategory {
  id: string;
  name: string;
  rooms: Array<{ roomId: string; name: string }>;
}

interface RoomCategoryGroup {
  id: string;
  name: string;
  rooms: Array<{ roomId: string; name: string }>;
}

interface MemberItem {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
}

const MOBILE_BREAKPOINT = 1024;
const HOME_SPACE_ID = "__home__";

const { client, isLoggedIn, userId, getRooms, logout, loadOlderMessages } =
  useMatrixClient();
const { translateText } = useAppI18n();

const selectedRoomId = ref<string | null>(null);
const selectedSpaceId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const matrixRooms = ref<Array<Record<string, any>>>([]);
const loadingOlder = ref(false);
const canLoadOlder = ref(true);
const loadMessagesTimerId = ref<number | null>(null);
const leftSidebarOpen = ref(true);
const rightSidebarOpen = ref(true);
const isMobile = ref(false);
const viewportInitialized = ref(false);
const spaceRailExpanded = ref(false);

if (!isLoggedIn.value) {
  navigateTo("/login");
}

function getRoomType(room: Record<string, any>): string | undefined {
  return (room as { getType?: () => string }).getType?.();
}

function getParentSpaceIds(room: Record<string, any>): string[] {
  const currentState = room.currentState;
  const stateEvents = currentState?.getStateEvents?.("m.space.parent");

  if (!stateEvents) {
    return [];
  }

  const normalizedEvents = Array.isArray(stateEvents)
    ? stateEvents
    : [stateEvents];

  return normalizedEvents
    .map((stateEvent) => stateEvent?.getStateKey?.())
    .filter((spaceId): spaceId is string => Boolean(spaceId));
}

function refreshRooms() {
  matrixRooms.value = getRooms();
}

const spaceItems = computed<SpaceItem[]>(() => {
  const spaces = matrixRooms.value
    .filter((room) => getRoomType(room) === "m.space")
    .map((spaceRoom) => ({
      id: spaceRoom.roomId,
      name: spaceRoom.name || translateText("layout.spaceFallback"),
      avatarUrl: getSpaceAvatarUrl(spaceRoom),
    }));

  return [
    { id: HOME_SPACE_ID, name: translateText("layout.homeSpace") },
    ...spaces,
  ];
});

const roomItems = computed<RoomItem[]>(() => {
  return matrixRooms.value
    .filter((room) => getRoomType(room) !== "m.space")
    .map((room) => ({
      roomId: room.roomId,
      name: room.name || translateText("layout.roomFallback"),
      parentSpaceIds: getParentSpaceIds(room),
    }));
});

const selectedSpaceName = computed(() => {
  return (
    spaceItems.value.find((space) => space.id === selectedSpaceId.value)
      ?.name ?? translateText("layout.homeSpace")
  );
});

const visibleRooms = computed(() => {
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return roomItems.value;
  }
  if (!selectedSpaceId.value) {
    return [];
  }
  const activeSpaceId = selectedSpaceId.value;
  return roomItems.value.filter((room) => {
    if (room.parentSpaceIds.length === 0) {
      return activeSpaceId === HOME_SPACE_ID;
    }
    return activeSpaceId ? room.parentSpaceIds.includes(activeSpaceId) : false;
  });
});

const roomCategories = computed<RoomCategoryGroup[]>(() => {
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return buildHomeSections();
  }
  return buildSpaceSections();
});

function buildHomeSections(): RoomCategoryGroup[] {
  const directRooms = visibleRooms.value.filter((room) => isDirectRoom(room));
  const unassignedRooms = visibleRooms.value.filter((room) => {
    return room.parentSpaceIds.length === 0 && !isDirectRoom(room);
  });

  const categories: RoomCategoryGroup[] = [];
  if (directRooms.length > 0) {
    categories.push({
      id: "personal-chats",
      name: translateText("layout.personalChats"),
      rooms: directRooms.map((room) => ({
        roomId: room.roomId,
        name: room.name,
      })),
    });
  }
  if (unassignedRooms.length > 0) {
    categories.push({
      id: "unassigned-rooms",
      name: translateText("layout.unassignedRooms"),
      rooms: unassignedRooms.map((room) => ({
        roomId: room.roomId,
        name: room.name,
      })),
    });
  }

  return categories;
}

function buildSpaceSections(): RoomCategoryGroup[] {
  const roomsInSpace = visibleRooms.value.filter((room) => !isDirectRoom(room));
  const categories = new Map<string, RoomCategory>();

  for (const room of roomsInSpace) {
    const segments = room.name.split("/");
    const rawCategory = segments.length > 1 ? (segments[0] || "").trim() : "";
    const categoryName = rawCategory || translateText("layout.generalCategory");
    const roomName =
      segments.length > 1 ? segments.slice(1).join("/").trim() : room.name;
    const categoryId = categoryName.toLowerCase().replace(/\s+/g, "-");
    if (!categories.has(categoryId)) {
      categories.set(categoryId, {
        id: categoryId,
        name: categoryName,
        rooms: [],
      });
    }

    const category = categories.get(categoryId);
    if (!category) {
      continue;
    }
    category.rooms.push({
      roomId: room.roomId,
      name: roomName || room.name,
    });
  }

  return Array.from(categories.values());
}

const selectedRoom = computed(() => {
  if (!selectedRoomId.value) {
    return null;
  }
  return client.value?.getRoom(selectedRoomId.value) ?? null;
});

const memberItems = computed<MemberItem[]>(() => {
  const room = selectedRoom.value;
  if (!room) {
    return [];
  }

  return room
    .getMembers()
    .map((member) => toMemberItem(member))
    .sort((memberA, memberB) => {
      const rank = {
        online: 0,
        busy: 1,
        away: 2,
        offline: 3,
        unknown: 4,
      } as const;
      const statusRankDiff = rank[memberA.status] - rank[memberB.status];
      if (statusRankDiff !== 0) {
        return statusRankDiff;
      }
      return memberA.displayName.localeCompare(memberB.displayName);
    });
});

watch(
  spaceItems,
  (spaces) => {
    if (spaces.length === 0) {
      selectedSpaceId.value = null;
      return;
    }
    const selectedExists = spaces.some(
      (space) => space.id === selectedSpaceId.value,
    );
    if (!selectedExists) {
      const firstSpace = spaces[0];
      if (firstSpace) {
        selectedSpaceId.value = firstSpace.id;
      }
    }
  },
  { immediate: true },
);

watch(
  visibleRooms,
  (rooms) => {
    if (rooms.length === 0) {
      selectedRoomId.value = null;
      messages.value = [];
      return;
    }
    const selectedExists = rooms.some(
      (room) => room.roomId === selectedRoomId.value,
    );
    if (!selectedExists) {
      const firstRoom = rooms[0];
      if (firstRoom) {
        selectedRoomId.value = firstRoom.roomId;
      }
    }
  },
  { immediate: true },
);

watch(selectedRoomId, (roomId) => {
  canLoadOlder.value = true;
  if (roomId) {
    loadMessages(roomId);
  }
});

function toMemberItem(member: Record<string, any>): MemberItem {
  return {
    userId: String(member.userId || ""),
    displayName: String(member.name || member.userId || ""),
    avatarUrl: getMemberAvatarUrl(member),
    status: normalizePresence(
      typeof member.presence === "string" ? member.presence : undefined,
    ),
  };
}

function normalizePresence(rawPresence: string | undefined): PresenceStatus {
  if (rawPresence === "online") {
    return "online";
  }
  if (rawPresence === "org.matrix.msc3026.busy" || rawPresence === "busy") {
    return "busy";
  }
  if (rawPresence === "dnd") {
    return "busy";
  }
  if (rawPresence === "unavailable") {
    return "away";
  }
  if (rawPresence === "offline") {
    return "offline";
  }
  return "unknown";
}

function isDirectRoom(room: RoomItem): boolean {
  const matrixRoom = matrixRooms.value.find(
    (entry) => entry.roomId === room.roomId,
  );
  if (!matrixRoom) {
    return false;
  }
  const joinedMemberCount = Number(matrixRoom.getJoinedMemberCount?.() ?? 0);
  return room.parentSpaceIds.length === 0 && joinedMemberCount === 2;
}

function getSpaceAvatarUrl(spaceRoom: Record<string, any>): string | undefined {
  const matrixClient = client.value;
  const homeserverUrl = matrixClient?.getHomeserverUrl?.();
  const getAvatarUrl = spaceRoom.getAvatarUrl;
  const accessToken = matrixClient?.getAccessToken?.();

  const withAccessToken = (
    url: string | null | undefined,
  ): string | undefined => {
    if (!url) {
      return undefined;
    }
    if (!accessToken || !url.includes("/_matrix/")) {
      return url;
    }
    if (url.includes("access_token=")) {
      return url;
    }
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;
  };

  if (homeserverUrl && typeof getAvatarUrl === "function") {
    const httpAvatarUrl = getAvatarUrl.call(
      spaceRoom,
      homeserverUrl,
      40,
      40,
      "crop",
      false,
      true,
    ) as string | null;
    if (httpAvatarUrl) {
      return withAccessToken(httpAvatarUrl);
    }
  }

  const avatarMxcFromRoom = spaceRoom.getMxcAvatarUrl?.();
  const avatarStateEvent = spaceRoom.currentState?.getStateEvents?.(
    "m.room.avatar",
    "",
  );
  const avatarMxcUrl =
    avatarMxcFromRoom || avatarStateEvent?.getContent?.()?.url;
  if (!avatarMxcUrl || !matrixClient?.mxcUrlToHttp) {
    return undefined;
  }

  try {
    const httpUrl = matrixClient.mxcUrlToHttp(
      avatarMxcUrl,
      40,
      40,
      "crop",
      false,
      true,
      true,
    ) as string;
    return withAccessToken(httpUrl);
  } catch {
    return undefined;
  }
}

function getMemberAvatarUrl(member: Record<string, any>): string | undefined {
  const matrixClient = client.value;
  const homeserverUrl = matrixClient?.getHomeserverUrl?.();
  const getAvatarUrl = member.getAvatarUrl;
  if (homeserverUrl && typeof getAvatarUrl === "function") {
    const avatarUrl = getAvatarUrl.call(
      member,
      homeserverUrl,
      40,
      40,
      "crop",
      false,
      false,
      true,
    ) as string | null;
    if (avatarUrl) {
      return appendAccessTokenToMediaUrl(avatarUrl);
    }
  }

  const avatarMxcUrl = member.events?.member?.getContent?.()?.avatar_url;
  if (!avatarMxcUrl || !matrixClient?.mxcUrlToHttp) {
    return undefined;
  }
  const avatarUrl = matrixClient.mxcUrlToHttp(
    avatarMxcUrl,
    40,
    40,
    "crop",
    false,
    true,
    true,
  );
  return appendAccessTokenToMediaUrl(avatarUrl);
}

function getMediaUrl(
  mxcUrl: string | null | undefined,
  mimetype?: string,
  body?: string,
  isEncrypted?: boolean,
): string | undefined {
  if (!mxcUrl || !client.value?.mxcUrlToHttp) {
    return undefined;
  }

  const isSvg =
    mimetype === "image/svg+xml" || body?.toLowerCase().endsWith(".svg");
  const shouldSkipThumbnail = isSvg || isEncrypted;

  try {
    const httpUrl = shouldSkipThumbnail
      ? client.value.mxcUrlToHttp(mxcUrl)
      : client.value.mxcUrlToHttp(mxcUrl, 800, 800, "scale", false, true, true);
    return appendAccessTokenToMediaUrl(httpUrl);
  } catch {
    return undefined;
  }
}

function appendAccessTokenToMediaUrl(
  avatarUrl: string | null | undefined,
): string | undefined {
  if (!avatarUrl) {
    return undefined;
  }
  const matrixClient = client.value;
  const accessToken = matrixClient?.getAccessToken?.();
  if (!accessToken || !avatarUrl.includes("/_matrix/")) {
    return avatarUrl;
  }
  if (avatarUrl.includes("access_token=")) {
    return avatarUrl;
  }
  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
}

function loadMessages(roomId: string) {
  const room = client.value?.getRoom(roomId);
  if (!room) {
    messages.value = [];
    return;
  }
  messages.value = mapTimelineEventsToMessages({
    room,
    ownUserId: client.value?.getUserId() ?? undefined,
    getMemberAvatarUrl: (member) => {
      return getMemberAvatarUrl(member as unknown as Record<string, any>);
    },
    getMediaUrl,
    buildNoticeText,
  });
}

function scheduleLoadMessages(roomId: string) {
  if (!import.meta.client) {
    loadMessages(roomId);
    return;
  }
  if (loadMessagesTimerId.value !== null) {
    window.clearTimeout(loadMessagesTimerId.value);
  }
  loadMessagesTimerId.value = window.setTimeout(() => {
    loadMessagesTimerId.value = null;
    loadMessages(roomId);
  }, 120);
}

function buildNoticeText(
  timelineEvent: Record<string, any>,
  room: Record<string, any>,
): string {
  const eventType = timelineEvent.getType?.() ?? "";
  const senderUserId = timelineEvent.getSender?.() ?? "";
  const senderName = room.getMember?.(senderUserId)?.name || senderUserId;
  const content = timelineEvent.getContent?.() ?? {};

  if (eventType === "m.room.member") {
    const membership = content.membership;
    const targetUserId = timelineEvent.getStateKey?.() ?? "";
    const targetName = room.getMember?.(targetUserId)?.name || targetUserId;
    const previousContent = timelineEvent.getPrevContent?.() ?? {};

    if (membership === "join" && previousContent.membership === "join") {
      if (content.avatar_url !== previousContent.avatar_url) {
        return `${targetName} changed avatar`;
      }
      if (content.displayname !== previousContent.displayname) {
        return `${targetName} changed display name`;
      }
      return `${targetName} profile updated`;
    }

    if (membership === "join") return `${targetName} joined the channel`;
    if (membership === "leave") return `${targetName} left the channel`;
    if (membership === "invite") return `${senderName} invited ${targetName}`;
    if (membership === "ban") return `${targetName} was banned`;
    return `${targetName} membership changed`;
  }

  if (eventType === "m.room.avatar") {
    return `${senderName} changed the room avatar`;
  }
  if (eventType === "m.room.name") {
    const nextName = content.name || "Unnamed room";
    return `${senderName} changed the room name to ${nextName}`;
  }
  if (eventType === "m.room.topic") {
    return `${senderName} updated the room topic`;
  }
  return `${senderName} updated room settings`;
}

async function onLoadOlder() {
  if (!selectedRoomId.value || loadingOlder.value) {
    return;
  }
  loadingOlder.value = true;
  try {
    const hasMoreMessages = await loadOlderMessages(selectedRoomId.value);
    canLoadOlder.value = hasMoreMessages;
    loadMessages(selectedRoomId.value);
  } finally {
    loadingOlder.value = false;
  }
}

function handleLogout() {
  logout();
  navigateTo("/login");
}

function selectSpace(spaceId: string) {
  selectedSpaceId.value = spaceId;
  if (isMobile.value) {
    leftSidebarOpen.value = false;
  }
}

function selectRoom(roomId: string) {
  selectedRoomId.value = roomId;
  if (isMobile.value) {
    leftSidebarOpen.value = false;
  }
}

function openSpaceSettings() {
  if (!selectedSpaceId.value) {
    return;
  }
  if (selectedSpaceId.value === HOME_SPACE_ID) {
    return;
  }
  navigateTo(`/settings/space/${selectedSpaceId.value}`);
}

function toggleLeftSidebar() {
  leftSidebarOpen.value = !leftSidebarOpen.value;
}

function toggleRightSidebar() {
  rightSidebarOpen.value = !rightSidebarOpen.value;
}

function toggleSpaceRail() {
  spaceRailExpanded.value = !spaceRailExpanded.value;
}

function openCreateSpaceStub() {
  navigateTo("/spaces/new");
}

function closeMobileOverlays() {
  if (!isMobile.value) {
    return;
  }
  leftSidebarOpen.value = false;
  rightSidebarOpen.value = false;
}

function syncViewport(force = false) {
  if (!import.meta.client) {
    return;
  }
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;

  const shouldReset =
    force || !viewportInitialized.value || wasMobile !== isMobile.value;

  if (shouldReset) {
    leftSidebarOpen.value = !isMobile.value;
    rightSidebarOpen.value = !isMobile.value;
    spaceRailExpanded.value = false;
  }

  viewportInitialized.value = true;
}

onMounted(() => {
  syncViewport(true);
  window.addEventListener("resize", resizeHandler);
});

const resizeHandler = () => syncViewport();

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return;
  }
  if (loadMessagesTimerId.value !== null) {
    window.clearTimeout(loadMessagesTimerId.value);
    loadMessagesTimerId.value = null;
  }
  window.removeEventListener("resize", resizeHandler);
});

watch(
  () => client.value,
  (matrixClient, _previousClient, onCleanup) => {
    if (!matrixClient) {
      return;
    }
    refreshRooms();
    matrixClient.once(ClientEvent.Sync, (state) => {
      if (state === "PREPARED") {
        refreshRooms();
      }
    });
    const timelineHandler = (
      _event: unknown,
      room: Record<string, any> | undefined,
    ) => {
      if (room?.roomId === selectedRoomId.value) {
        scheduleLoadMessages(room.roomId);
      }
    };
    const membershipHandler = () => {
      refreshRooms();
    };
    const decryptedHandler = (event: Record<string, any>) => {
      if (
        event?.getRoomId?.() === selectedRoomId.value &&
        selectedRoomId.value
      ) {
        scheduleLoadMessages(selectedRoomId.value);
      }
    };
    matrixClient.on(RoomEvent.Timeline, timelineHandler);
    matrixClient.on(RoomEvent.MyMembership, membershipHandler);
    matrixClient.on(MatrixEventEvent.Decrypted, decryptedHandler);
    onCleanup(() => {
      matrixClient.off(RoomEvent.Timeline, timelineHandler);
      matrixClient.off(RoomEvent.MyMembership, membershipHandler);
      matrixClient.off(MatrixEventEvent.Decrypted, decryptedHandler);
    });
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="decentra-shell relative flex h-dvh overflow-hidden bg-gray-100 dark:bg-gray-950"
  >
    <div
      v-if="isMobile && (leftSidebarOpen || rightSidebarOpen)"
      class="absolute inset-0 z-20 bg-black/50"
      @click="closeMobileOverlays"
    />

    <aside
      class="z-30 h-full overflow-hidden transition-all duration-200"
      :class="[
        isMobile
          ? spaceRailExpanded
            ? 'absolute left-0 top-0 w-[92vw] max-w-[544px]'
            : 'absolute left-0 top-0 w-[360px]'
          : leftSidebarOpen
            ? spaceRailExpanded
              ? 'relative w-[544px] shrink-0 border-r border-gray-200 dark:border-gray-800'
              : 'relative w-[360px] shrink-0 border-r border-gray-200 dark:border-gray-800'
            : 'relative w-0 shrink-0 border-r-0',
        isMobile
          ? leftSidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
          : 'translate-x-0',
      ]"
    >
      <div class="flex h-full">
        <ChatSpaceList
          :spaces="spaceItems"
          :selected-space-id="selectedSpaceId"
          :expanded="spaceRailExpanded"
          @select-space="selectSpace"
          @toggle-expanded="toggleSpaceRail"
          @create-space="openCreateSpaceStub"
        />
        <ChatRoomCategoryList
          :selected-space-name="selectedSpaceName"
          :categories="roomCategories"
          :selected-room-id="selectedRoomId"
          @select-room="selectRoom"
          @open-space-settings="openSpaceSettings"
        />
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-panels-left-bottom"
          :aria-label="translateText('layout.toggleNavigation')"
          @click="toggleLeftSidebar"
        />
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100"
          >
            {{ selectedRoom?.name || translateText("chat.selectRoom") }}
          </p>
          <p
            v-if="userId"
            class="truncate text-xs text-gray-500 dark:text-gray-400"
          >
            {{ translateText("chat.loggedInAs") }} {{ userId }}
          </p>
        </div>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-user-cog"
          :to="'/settings/account'"
          :aria-label="translateText('layout.openAccountSettings')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-panels-right-bottom"
          :aria-label="translateText('layout.toggleMembers')"
          @click="toggleRightSidebar"
        />
        <UButton size="sm" color="neutral" variant="soft" @click="handleLogout">
          {{ translateText("chat.signOut") }}
        </UButton>
      </header>

      <div
        v-if="!selectedRoomId"
        class="flex flex-1 items-center justify-center"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ translateText("chat.selectRoom") }}
        </p>
      </div>
      <template v-else>
        <ChatMessageList
          :messages="messages"
          :can-load-older="canLoadOlder"
          :loading-older="loadingOlder"
          @load-older="onLoadOlder"
        />
        <ChatMessageInput :room-id="selectedRoomId" :disabled="!client" />
      </template>
    </main>

    <aside
      class="z-30 h-full overflow-hidden transition-all duration-200"
      :class="[
        isMobile
          ? 'absolute right-0 top-0 w-72'
          : rightSidebarOpen
            ? 'relative w-72 shrink-0 border-l border-gray-200 dark:border-gray-800'
            : 'relative w-0 shrink-0 border-l-0',
        isMobile
          ? rightSidebarOpen
            ? 'translate-x-0'
            : 'translate-x-full'
          : 'translate-x-0',
      ]"
    >
      <ChatMemberList :members="memberItems" />
    </aside>
  </div>
</template>
