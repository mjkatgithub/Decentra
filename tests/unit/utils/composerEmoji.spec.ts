import { describe, expect, it } from "vitest";
import { emojiCatalog } from "~/composables/useEmojiPickerData";
import {
  applyShortcodeCompletion,
  findTrailingShortcodeToken,
  insertTextAtSelection,
  matchShortcodeSuggestions,
} from "~/utils/composerEmoji";

describe("composerEmoji", () => {
  it("inserts text at selection", () => {
    const result = insertTextAtSelection("hello world", 5, 5, "👋 ");
    expect(result.nextText).toBe("hello👋  world");
    expect(result.selectionStart).toBe(8);
  });

  it("finds trailing shortcode token", () => {
    const token = findTrailingShortcodeToken("hi :see_no", 10);
    expect(token).not.toBeNull();
    expect(token?.prefix).toBe("see_no");
    expect(token?.start).toBe(3);
  });

  it("returns null for bare colon", () => {
    expect(findTrailingShortcodeToken("hi :", 4)).toBeNull();
  });

  it("matches wave prefix before longer shortcodes", () => {
    const suggestions = matchShortcodeSuggestions("wa", emojiCatalog);
    expect(suggestions[0]?.shortcode).toBe("wave");
    expect(suggestions[0]?.emoji).toBe("👋");
  });

  it("applies shortcode completion", () => {
    const token = findTrailingShortcodeToken("test :wa", 8);
    expect(token).not.toBeNull();
    if (!token) {
      return;
    }
    const result = applyShortcodeCompletion("test :wa", token, "👋");
    expect(result.nextText).toBe("test 👋");
  });
});
