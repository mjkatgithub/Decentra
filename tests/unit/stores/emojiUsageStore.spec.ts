import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEmojiUsageStore } from "~/stores/emojiUsageStore";

describe("emojiUsageStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("tracks usage by scope and persists it", () => {
    const emojiUsageStore = useEmojiUsageStore();

    emojiUsageStore.track("roomA", "👍");
    emojiUsageStore.track("roomA", "👍");
    emojiUsageStore.track("roomA", "🎉");

    const usage = emojiUsageStore.getUsage("roomA");
    expect(usage["👍"]).toBe(2);
    expect(usage["🎉"]).toBe(1);
  });

  it("returns frequent emojis with defaults", () => {
    const emojiUsageStore = useEmojiUsageStore();
    emojiUsageStore.track("roomA", "🎉");

    const frequent = emojiUsageStore.frequentEmojis("roomA");
    expect(frequent.value[0]).toBe("🎉");
    expect(frequent.value.length).toBeGreaterThan(1);
  });
});
