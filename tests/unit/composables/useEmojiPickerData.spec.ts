import { describe, expect, it } from "vitest";
import {
  createShortcodeMap,
  emojiCatalog,
  normalizeShortcodes,
} from "~/composables/useEmojiPickerData";
import { matchShortcodeSuggestions } from "~/utils/composerEmoji";

describe("useEmojiPickerData extended catalog", () => {
  const shortcodeMap = createShortcodeMap(emojiCatalog);

  it("normalizes see_no_evil shortcode", () => {
    expect(normalizeShortcodes(":see_no_evil:", shortcodeMap)).toBe("🙈");
  });

  it("normalizes poop and skull shortcodes", () => {
    expect(normalizeShortcodes(":poop:", shortcodeMap)).toBe("💩");
    expect(normalizeShortcodes(":skull:", shortcodeMap)).toBe("💀");
  });

  it("normalizes slight_smile and ok_hand", () => {
    expect(normalizeShortcodes(":slight_smile:", shortcodeMap)).toBe("🙂");
    expect(normalizeShortcodes(":ok_hand:", shortcodeMap)).toBe("👌");
  });

  it("suggests see_no_evil for see_no prefix", () => {
    const suggestions = matchShortcodeSuggestions("see_no", emojiCatalog);
    const shortcodes = suggestions.map((item) => item.shortcode);
    expect(shortcodes).toContain("see_no_evil");
    expect(suggestions.find((item) => item.shortcode === "see_no_evil")?.emoji)
      .toBe("🙈");
  });
});
