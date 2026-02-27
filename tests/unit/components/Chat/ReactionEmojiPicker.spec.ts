import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ChatReactionEmojiPicker from "~/components/Chat/ReactionEmojiPicker.vue";
import { buildFrequentEmojiStorageKey } from "~/composables/useEmojiPickerData";

describe("ReactionEmojiPicker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits selected emoji when clicking an emoji option", async () => {
    const wrapper = mount(ChatReactionEmojiPicker);
    const firstEmojiButton = wrapper.find('[data-emoji-option="👍"]');
    await firstEmojiButton.trigger("click");

    const emittedEvents = wrapper.emitted("select") ?? [];
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0]?.[0]).toBe("👍");
  });

  it("converts shortcode input before emit", async () => {
    const wrapper = mount(ChatReactionEmojiPicker);
    const input = wrapper.find('input[placeholder="Any emoji or :wave:"]');
    await input.setValue(":wave:");
    await input.trigger("keydown.enter");

    const emittedEvents = wrapper.emitted("select") ?? [];
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0]?.[0]).toBe("👋");
  });

  it("supports :people_hugging: shortcode", async () => {
    const wrapper = mount(ChatReactionEmojiPicker);
    const input = wrapper.find('input[placeholder="Any emoji or :wave:"]');
    await input.setValue(":people_hugging:");
    await input.trigger("keydown.enter");

    const emittedEvents = wrapper.emitted("select") ?? [];
    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0]?.[0]).toBe("🫂");
  });

  it("persists frequent usage in localStorage", async () => {
    const wrapper = mount(ChatReactionEmojiPicker, {
      props: {
        frequentScopeKey: "@alice:example.org",
      },
    });
    await wrapper.find('[data-emoji-option="👍"]').trigger("click");
    await wrapper.find('[data-emoji-option="👍"]').trigger("click");
    await wrapper.find('[data-emoji-option="👍"]').trigger("click");

    const storageKey = buildFrequentEmojiStorageKey("@alice:example.org");
    const storedValue = localStorage.getItem(storageKey);
    const parsedValue = storedValue
      ? (JSON.parse(storedValue) as Record<string, number>)
      : {};
    expect(parsedValue["👍"]).toBe(3);
  });
});
