import type { EmojiEntry } from "~/composables/useEmojiPickerData";

export interface ShortcodeSuggestion {
  shortcode: string;
  emoji: string;
}

export interface TrailingShortcodeToken {
  start: number;
  end: number;
  prefix: string;
}

function clampCursor(position: number, length: number): number {
  return Math.max(0, Math.min(position, length));
}

export function insertTextAtSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insertText: string
): { nextText: string; selectionStart: number } {
  const start = clampCursor(selectionStart, text.length);
  const end = clampCursor(selectionEnd, text.length);
  const nextText = text.slice(0, start) + insertText + text.slice(end);
  const nextCursor = clampCursor(start + insertText.length, nextText.length);
  return { nextText, selectionStart: nextCursor };
}

const TRAILING_SHORTCODE_PATTERN = /:([a-z0-9_+-]*)$/i;

export function findTrailingShortcodeToken(
  text: string,
  cursor: number
): TrailingShortcodeToken | null {
  const safeCursor = clampCursor(cursor, text.length);
  const beforeCursor = text.slice(0, safeCursor);
  const match = beforeCursor.match(TRAILING_SHORTCODE_PATTERN);
  if (!match || match.index === undefined) {
    return null;
  }
  const prefix = match[1] ?? "";
  if (prefix.length === 0) {
    return null;
  }
  return {
    start: match.index,
    end: safeCursor,
    prefix,
  };
}

function shortcodeMatchesPrefix(shortcode: string, prefix: string): boolean {
  const normalizedShortcode = shortcode.toLowerCase();
  const normalizedPrefix = prefix.toLowerCase();
  if (normalizedShortcode.startsWith(normalizedPrefix)) {
    return true;
  }
  return normalizedShortcode.replace(/[_-]/g, "").startsWith(
    normalizedPrefix.replace(/[_-]/g, "")
  );
}

export function matchShortcodeSuggestions(
  prefix: string,
  entries: EmojiEntry[],
  options?: { limit?: number }
): ShortcodeSuggestion[] {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix) {
    return [];
  }
  const limit = options?.limit ?? 8;
  const suggestions: ShortcodeSuggestion[] = [];
  const seenShortcodes = new Set<string>();

  for (const emojiEntry of entries) {
    for (const shortcode of emojiEntry.shortcodes) {
      if (!shortcodeMatchesPrefix(shortcode, trimmedPrefix)) {
        continue;
      }
      const dedupeKey = shortcode.toLowerCase();
      if (seenShortcodes.has(dedupeKey)) {
        continue;
      }
      seenShortcodes.add(dedupeKey);
      suggestions.push({
        shortcode,
        emoji: emojiEntry.emoji,
      });
    }
  }

  return suggestions
    .sort((left, right) => {
      const lengthDelta = left.shortcode.length - right.shortcode.length;
      if (lengthDelta !== 0) {
        return lengthDelta;
      }
      return left.shortcode.localeCompare(right.shortcode);
    })
    .slice(0, limit);
}

export function applyShortcodeCompletion(
  text: string,
  token: TrailingShortcodeToken,
  emoji: string
): { nextText: string; selectionStart: number } {
  return insertTextAtSelection(text, token.start, token.end, emoji);
}
