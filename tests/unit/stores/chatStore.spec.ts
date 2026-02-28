import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useChatStore } from "~/stores/chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("toggles layout preferences and mobile overlays", () => {
    const chatStore = useChatStore();

    chatStore.syncViewport(480, true);
    expect(chatStore.isMobile).toBe(true);
    expect(chatStore.leftSidebarOpen).toBe(false);

    chatStore.toggleLeftSidebar();
    chatStore.toggleRightSidebar();
    expect(chatStore.leftSidebarOpen).toBe(true);
    expect(chatStore.rightSidebarOpen).toBe(true);

    chatStore.closeMobileOverlays();
    expect(chatStore.leftSidebarOpen).toBe(false);
    expect(chatStore.rightSidebarOpen).toBe(false);
  });

  it("resets message window state", () => {
    const chatStore = useChatStore();
    chatStore.allMessages = [{ id: "evt1" } as any];
    chatStore.messages = [{ id: "evt1" } as any];
    chatStore.windowStartIndex = 3;
    chatStore.windowEndIndex = 7;

    chatStore.resetMessages();

    expect(chatStore.allMessages).toEqual([]);
    expect(chatStore.messages).toEqual([]);
    expect(chatStore.windowStartIndex).toBe(0);
    expect(chatStore.windowEndIndex).toBe(0);
  });
});
