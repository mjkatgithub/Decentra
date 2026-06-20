import { extendedEmojiCatalog } from "~/composables/extendedEmojiCatalog";

export type EmojiCategoryId =
  | "frequent"
  | "smileys"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols"
  | "flags";

export interface EmojiCategory {
  id: EmojiCategoryId;
  label: string;
  icon: string;
}

export interface EmojiEntry {
  emoji: string;
  name: string;
  shortcodes: string[];
  keywords: string[];
  category: Exclude<EmojiCategoryId, "frequent">;
}

const FREQUENT_EMOJI_STORAGE_KEY_PREFIX = "decentra.chat.frequent-emojis.v1";

export const categoryOrder: EmojiCategory[] = [
  { id: "frequent", label: "Häufig verwendet", icon: "🕘" },
  { id: "smileys", label: "Smileys & Menschen", icon: "😀" },
  { id: "animals", label: "Tiere & Natur", icon: "🐶" },
  { id: "food", label: "Essen & Trinken", icon: "🍎" },
  { id: "activities", label: "Aktivitäten", icon: "⚽" },
  { id: "travel", label: "Reisen", icon: "🚗" },
  { id: "objects", label: "Objekte", icon: "💡" },
  { id: "symbols", label: "Symbole", icon: "❗" },
  { id: "flags", label: "Flaggen", icon: "🏳️" },
];

export const defaultFrequentEmojis = [
  "👍", "👎", "😂", "🎉", "😮", "❤️", "🚀", "👀",
];

function createEmojiEntry(input: EmojiEntry): EmojiEntry {
  return input;
}

export const emojiCatalog: EmojiEntry[] = [
  createEmojiEntry({
    emoji: "😀", name: "grinning", shortcodes: ["grinning"],
    keywords: ["face", "smile"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😃", name: "smiley", shortcodes: ["smiley"],
    keywords: ["happy", "face"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😄", name: "smile", shortcodes: ["smile"],
    keywords: ["joy", "face"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😁", name: "grin", shortcodes: ["grin"],
    keywords: ["happy", "teeth"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😂", name: "joy", shortcodes: ["joy", "laughing"],
    keywords: ["tears", "laugh"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤣", name: "rofl", shortcodes: ["rofl"],
    keywords: ["laugh"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😊", name: "blush", shortcodes: ["blush"],
    keywords: ["happy", "smile"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😉", name: "wink", shortcodes: ["wink"],
    keywords: ["face"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😍", name: "heart eyes", shortcodes: ["heart_eyes"],
    keywords: ["love", "face"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😘", name: "kiss", shortcodes: ["kissing_heart"],
    keywords: ["love"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😎", name: "sunglasses", shortcodes: ["sunglasses"],
    keywords: ["cool"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😭", name: "sob", shortcodes: ["sob"],
    keywords: ["sad"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😢", name: "cry", shortcodes: ["cry"],
    keywords: ["sad"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😡", name: "angry", shortcodes: ["angry"],
    keywords: ["mad"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤔", name: "thinking", shortcodes: ["thinking", "thinking_face"],
    keywords: ["hmm"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😮", name: "open mouth", shortcodes: ["open_mouth"],
    keywords: ["surprised"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😴", name: "sleeping", shortcodes: ["sleeping"],
    keywords: ["tired"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤯", name: "mind blown", shortcodes: ["exploding_head"],
    keywords: ["wow"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "😅", name: "sweat smile", shortcodes: ["sweat_smile"],
    keywords: ["awkward"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤗", name: "hugging", shortcodes: ["hugging_face"],
    keywords: ["hug"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🫡", name: "saluting", shortcodes: ["saluting_face"],
    keywords: ["respect"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🙏", name: "pray", shortcodes: ["pray"],
    keywords: ["thanks"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "👋", name: "wave", shortcodes: ["wave"],
    keywords: ["hello"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🫂",
    name: "people hugging",
    shortcodes: ["people_hugging", "hugging_people"],
    keywords: ["hug", "support", "care"],
    category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤝", name: "handshake", shortcodes: ["handshake"],
    keywords: ["deal"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "👏", name: "clap", shortcodes: ["clap"],
    keywords: ["applause"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "👍",
    name: "thumbs up",
    shortcodes: ["thumbsup", "+1", "thumbs_up", "thumbs-up"],
    keywords: ["like"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "👎",
    name: "thumbs down",
    shortcodes: ["thumbsdown", "-1", "thumbs_down", "thumbs-down"],
    keywords: ["dislike"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🔥", name: "fire", shortcodes: ["fire"],
    keywords: ["lit"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "💯", name: "100", shortcodes: ["100"],
    keywords: ["perfect"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤷", name: "shrug", shortcodes: ["shrug"],
    keywords: ["idk"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🤦", name: "facepalm", shortcodes: ["facepalm"],
    keywords: ["oops"], category: "smileys",
  }),
  createEmojiEntry({
    emoji: "🐶", name: "dog", shortcodes: ["dog"], keywords: ["pet"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐱", name: "cat", shortcodes: ["cat"], keywords: ["pet"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐭", name: "mouse", shortcodes: ["mouse"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐹", name: "hamster", shortcodes: ["hamster"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐰", name: "rabbit", shortcodes: ["rabbit"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🦊", name: "fox", shortcodes: ["fox"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐻", name: "bear", shortcodes: ["bear"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐼", name: "panda", shortcodes: ["panda_face"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐨", name: "koala", shortcodes: ["koala"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐯", name: "tiger", shortcodes: ["tiger"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🦁", name: "lion", shortcodes: ["lion"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐷", name: "pig", shortcodes: ["pig"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐸", name: "frog", shortcodes: ["frog"], keywords: ["animal"],
    category: "animals",
  }),
  createEmojiEntry({
    emoji: "🐵", name: "monkey", shortcodes: ["monkey_face"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🦄", name: "unicorn", shortcodes: ["unicorn"],
    keywords: ["animal"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🌱", name: "seedling", shortcodes: ["seedling"],
    keywords: ["plant"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🌳", name: "tree", shortcodes: ["deciduous_tree"],
    keywords: ["nature"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🌞", name: "sun", shortcodes: ["sun_with_face"],
    keywords: ["weather"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🌧️", name: "rain cloud", shortcodes: ["cloud_with_rain"],
    keywords: ["weather"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🌙", name: "moon", shortcodes: ["crescent_moon"],
    keywords: ["night"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "⭐", name: "star", shortcodes: ["star"],
    keywords: ["night"], category: "animals",
  }),
  createEmojiEntry({
    emoji: "🍎", name: "apple", shortcodes: ["apple"], keywords: ["fruit"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍌", name: "banana", shortcodes: ["banana"], keywords: ["fruit"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍇", name: "grapes", shortcodes: ["grapes"], keywords: ["fruit"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍓", name: "strawberry", shortcodes: ["strawberry"],
    keywords: ["fruit"], category: "food",
  }),
  createEmojiEntry({
    emoji: "🍕", name: "pizza", shortcodes: ["pizza"], keywords: ["food"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍔", name: "burger", shortcodes: ["hamburger"],
    keywords: ["food"], category: "food",
  }),
  createEmojiEntry({
    emoji: "🍟", name: "fries", shortcodes: ["fries"], keywords: ["food"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🌮", name: "taco", shortcodes: ["taco"], keywords: ["food"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍣", name: "sushi", shortcodes: ["sushi"], keywords: ["food"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍜", name: "ramen", shortcodes: ["ramen"], keywords: ["food"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍰", name: "cake", shortcodes: ["cake"], keywords: ["dessert"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍪", name: "cookie", shortcodes: ["cookie"],
    keywords: ["dessert"], category: "food",
  }),
  createEmojiEntry({
    emoji: "☕", name: "coffee", shortcodes: ["coffee"], keywords: ["drink"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🍺", name: "beer", shortcodes: ["beer"], keywords: ["drink"],
    category: "food",
  }),
  createEmojiEntry({
    emoji: "🥤", name: "cup", shortcodes: ["cup_with_straw"],
    keywords: ["drink"], category: "food",
  }),
  createEmojiEntry({
    emoji: "⚽", name: "soccer", shortcodes: ["soccer"], keywords: ["sport"],
    category: "activities",
  }),
  createEmojiEntry({
    emoji: "🏀", name: "basketball", shortcodes: ["basketball"],
    keywords: ["sport"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🏈", name: "football", shortcodes: ["football"],
    keywords: ["sport"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎾", name: "tennis", shortcodes: ["tennis"], keywords: ["sport"],
    category: "activities",
  }),
  createEmojiEntry({
    emoji: "🏓", name: "ping pong", shortcodes: ["ping_pong"],
    keywords: ["sport"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎮", name: "gamepad", shortcodes: ["video_game"],
    keywords: ["gaming"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🧩", name: "puzzle", shortcodes: ["jigsaw"], keywords: ["game"],
    category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎵", name: "music", shortcodes: ["musical_note"],
    keywords: ["song"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎸", name: "guitar", shortcodes: ["guitar"], keywords: ["music"],
    category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎬", name: "clapper", shortcodes: ["clapper"],
    keywords: ["movie"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🎉", name: "party", shortcodes: ["tada"],
    keywords: ["celebration"], category: "activities",
  }),
  createEmojiEntry({
    emoji: "🏆", name: "trophy", shortcodes: ["trophy"], keywords: ["win"],
    category: "activities",
  }),
  createEmojiEntry({
    emoji: "🚗", name: "car", shortcodes: ["car"], keywords: ["travel"],
    category: "travel",
  }),
  createEmojiEntry({
    emoji: "🚕", name: "taxi", shortcodes: ["taxi"], keywords: ["travel"],
    category: "travel",
  }),
  createEmojiEntry({
    emoji: "🚌", name: "bus", shortcodes: ["bus"], keywords: ["travel"],
    category: "travel",
  }),
  createEmojiEntry({
    emoji: "🚲", name: "bike", shortcodes: ["bike"], keywords: ["travel"],
    category: "travel",
  }),
  createEmojiEntry({
    emoji: "🏍️", name: "motorcycle", shortcodes: ["motorcycle"],
    keywords: ["travel"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "✈️", name: "airplane", shortcodes: ["airplane"],
    keywords: ["flight"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "🛫", name: "takeoff", shortcodes: ["airplane_departure"],
    keywords: ["flight"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "🚀", name: "rocket", shortcodes: ["rocket"],
    keywords: ["launch"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "🏖️", name: "beach", shortcodes: ["beach_with_umbrella"],
    keywords: ["vacation"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "🗺️", name: "map", shortcodes: ["world_map"],
    keywords: ["travel"], category: "travel",
  }),
  createEmojiEntry({
    emoji: "💡", name: "bulb", shortcodes: ["bulb"], keywords: ["idea"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "📌", name: "pushpin", shortcodes: ["pushpin"],
    keywords: ["mark"], category: "objects",
  }),
  createEmojiEntry({
    emoji: "📎", name: "paperclip", shortcodes: ["paperclip"],
    keywords: ["attach"], category: "objects",
  }),
  createEmojiEntry({
    emoji: "📱", name: "phone", shortcodes: ["iphone"],
    keywords: ["mobile"], category: "objects",
  }),
  createEmojiEntry({
    emoji: "💻", name: "computer", shortcodes: ["computer"],
    keywords: ["tech"], category: "objects",
  }),
  createEmojiEntry({
    emoji: "⌚", name: "watch", shortcodes: ["watch"], keywords: ["time"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "🔔", name: "bell", shortcodes: ["bell"], keywords: ["notify"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "🔒", name: "lock", shortcodes: ["lock"], keywords: ["secure"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "🔑", name: "key", shortcodes: ["key"], keywords: ["secure"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "🧠", name: "brain", shortcodes: ["brain"], keywords: ["think"],
    category: "objects",
  }),
  createEmojiEntry({
    emoji: "❤️",
    name: "heart",
    shortcodes: ["heart", "red_heart"],
    keywords: ["love"],
    category: "symbols",
  }),
  createEmojiEntry({
    emoji: "🩷", name: "pink heart", shortcodes: ["pink_heart"],
    keywords: ["love"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "💔", name: "broken heart", shortcodes: ["broken_heart"],
    keywords: ["sad"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "✅", name: "check", shortcodes: ["white_check_mark"],
    keywords: ["ok"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "❌", name: "x", shortcodes: ["x"], keywords: ["no"],
    category: "symbols",
  }),
  createEmojiEntry({
    emoji: "❗", name: "exclamation", shortcodes: ["exclamation"],
    keywords: ["important"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "❓", name: "question", shortcodes: ["question"],
    keywords: ["help"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "⚠️", name: "warning", shortcodes: ["warning"],
    keywords: ["alert"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "♻️", name: "recycle", shortcodes: ["recycle"],
    keywords: ["green"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "✨", name: "sparkles", shortcodes: ["sparkles"],
    keywords: ["magic"], category: "symbols",
  }),
  createEmojiEntry({
    emoji: "👀", name: "eyes", shortcodes: ["eyes"], keywords: ["look"],
    category: "symbols",
  }),
  createEmojiEntry({
    emoji: "🏳️", name: "white flag", shortcodes: ["white_flag"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🏴", name: "black flag", shortcodes: ["black_flag"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🏁", name: "chequered flag", shortcodes: ["checkered_flag"],
    keywords: ["race"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇩🇪", name: "germany", shortcodes: ["flag_de"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇪🇺", name: "eu", shortcodes: ["flag_eu"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇺🇸", name: "usa", shortcodes: ["flag_us"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇬🇧", name: "uk", shortcodes: ["flag_gb"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇫🇷", name: "france", shortcodes: ["flag_fr"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇪🇸", name: "spain", shortcodes: ["flag_es"],
    keywords: ["flag"], category: "flags",
  }),
  createEmojiEntry({
    emoji: "🇮🇹", name: "italy", shortcodes: ["flag_it"],
    keywords: ["flag"], category: "flags",
  }),
  ...extendedEmojiCatalog,
];

export function createShortcodeMap(entries: EmojiEntry[]): Map<string, string> {
  const shortcodeToEmoji = new Map<string, string>();
  for (const emojiEntry of entries) {
    for (const shortcode of emojiEntry.shortcodes) {
      const normalizedShortcode = shortcode.toLowerCase();
      shortcodeToEmoji.set(normalizedShortcode, emojiEntry.emoji);
      shortcodeToEmoji.set(
        normalizedShortcode.replace(/-/g, "_"),
        emojiEntry.emoji
      );
      shortcodeToEmoji.set(
        normalizedShortcode.replace(/_/g, "-"),
        emojiEntry.emoji
      );
      shortcodeToEmoji.set(
        normalizedShortcode.replace(/[_-]/g, ""),
        emojiEntry.emoji
      );
    }
  }
  return shortcodeToEmoji;
}

export function normalizeShortcodes(
  rawValue: string,
  shortcodeMap: Map<string, string>
): string {
  return rawValue.replace(/:([a-z0-9_+-]+):/gi, (matchText, shortcode) => {
    const shortcodeEmoji = shortcodeMap.get(String(shortcode).toLowerCase());
    return shortcodeEmoji ?? matchText;
  });
}

function buildScopeStorageSuffix(scopeKey?: string): string {
  if (!scopeKey || scopeKey.trim().length === 0) {
    return "anonymous";
  }
  return scopeKey.trim().toLowerCase();
}

export function buildFrequentEmojiStorageKey(scopeKey?: string): string {
  const scopeSuffix = buildScopeStorageSuffix(scopeKey);
  return `${FREQUENT_EMOJI_STORAGE_KEY_PREFIX}.${scopeSuffix}`;
}

export function loadFrequentEmojiUsage(
  scopeKey?: string
): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }
  const storageKey = buildFrequentEmojiStorageKey(scopeKey);
  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) {
    return {};
  }
  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, number>;
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

export function saveFrequentEmojiUsage(
  usage: Record<string, number>,
  scopeKey?: string
): void {
  if (typeof window === "undefined") {
    return;
  }
  const storageKey = buildFrequentEmojiStorageKey(scopeKey);
  localStorage.setItem(storageKey, JSON.stringify(usage));
}

export function trackEmojiUsage(
  usage: Record<string, number>,
  emoji: string
): Record<string, number> {
  const nextUsage = { ...usage };
  nextUsage[emoji] = (nextUsage[emoji] ?? 0) + 1;
  return nextUsage;
}

export function getFrequentEmojis(
  usage: Record<string, number>,
  fallbackEmojis: string[],
  limit = 12
): string[] {
  const byUsage = Object.entries(usage)
    .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
    .map(([emoji]) => emoji);
  const merged: string[] = [];
  for (const emoji of [...byUsage, ...fallbackEmojis]) {
    if (!merged.includes(emoji)) {
      merged.push(emoji);
    }
    if (merged.length >= limit) {
      break;
    }
  }
  return merged;
}
