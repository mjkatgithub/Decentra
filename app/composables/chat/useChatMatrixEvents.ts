import {
  MatrixEventEvent,
  RoomEvent,
} from "matrix-js-sdk";

export function useChatMatrixEvents(options: {
  client: Ref<Record<string, any> | null>;
  selectedRoomId: Ref<string | null>;
  selectedSpaceId: Ref<string | null>;
  pinnedListVersion: Ref<number>;
  scheduleThreadNavRefresh: () => void;
  patchMessageReactions: (roomId: string) => void;
  scheduleLoadMessages: (roomId: string) => void;
  isReactionRelatedEvent: (eventType: string) => boolean;
  scheduleSpaceHierarchyRefresh: () => void;
  refreshRooms: () => void;
}) {
  function setupMatrixEventWatchers() {
    watch(
      () => options.client.value,
      (matrixClient, _previousClient, onCleanup) => {
        if (!matrixClient) {
          options.selectedSpaceId.value = null;
          options.selectedRoomId.value = null;
          return;
        }
        options.refreshRooms();
        const timelineHandler = (
          timelineEvent: Record<string, any> | undefined,
          room: Record<string, any> | undefined,
        ) => {
          if (room?.roomId) {
            const eventType = timelineEvent?.getType?.() ?? "";
            if (
              eventType === "m.room.message" ||
              options.isReactionRelatedEvent(eventType)
            ) {
              options.scheduleThreadNavRefresh();
            }
          }
          if (room?.roomId === options.selectedRoomId.value) {
            const eventType = timelineEvent?.getType?.() ?? "";
            if (eventType === "m.room.pinned_events") {
              options.pinnedListVersion.value += 1;
            }
            if (eventType === "m.reaction") {
              options.patchMessageReactions(room.roomId);
              return;
            }
            if (eventType === "m.room.redaction") {
              options.patchMessageReactions(room.roomId);
              options.scheduleLoadMessages(room.roomId);
              return;
            }
            options.scheduleLoadMessages(room.roomId);
          }
        };
        const membershipHandler = () => {
          options.scheduleSpaceHierarchyRefresh();
        };
        const decryptedHandler = (event: Record<string, any>) => {
          if (
            event?.getRoomId?.() === options.selectedRoomId.value &&
            options.selectedRoomId.value
          ) {
            const eventType = event?.getType?.() ?? "";
            if (eventType === "m.reaction") {
              options.patchMessageReactions(
                options.selectedRoomId.value,
              );
              return;
            }
            if (eventType === "m.room.redaction") {
              options.patchMessageReactions(
                options.selectedRoomId.value,
              );
              options.scheduleLoadMessages(
                options.selectedRoomId.value,
              );
              return;
            }
            options.scheduleLoadMessages(
              options.selectedRoomId.value,
            );
          }
        };
        matrixClient.on(RoomEvent.Timeline, timelineHandler);
        matrixClient.on(RoomEvent.MyMembership, membershipHandler);
        matrixClient.on(MatrixEventEvent.Decrypted, decryptedHandler);
        onCleanup(() => {
          matrixClient.off(RoomEvent.Timeline, timelineHandler);
          matrixClient.off(RoomEvent.MyMembership, membershipHandler);
          matrixClient.off(
            MatrixEventEvent.Decrypted,
            decryptedHandler,
          );
        });
      },
      { immediate: true },
    );
  }

  return {
    setupMatrixEventWatchers,
  };
}
