import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  defaultFrequentEmojis,
  getFrequentEmojis,
  loadFrequentEmojiUsage,
  saveFrequentEmojiUsage,
  trackEmojiUsage,
} from "~/composables/useEmojiPickerData";

export const useEmojiUsageStore = defineStore("emojiUsage", () => {
  const usageByScope = ref<Record<string, Record<string, number>>>({});

  function normalizeScope(scopeKey?: string): string {
    if (!scopeKey || scopeKey.trim().length === 0) {
      return "anonymous";
    }
    return scopeKey.trim().toLowerCase();
  }

  function ensureScopeLoaded(scopeKey?: string) {
    const normalizedScope = normalizeScope(scopeKey);
    if (!usageByScope.value[normalizedScope]) {
      usageByScope.value[normalizedScope] = loadFrequentEmojiUsage(scopeKey);
    }
  }

  function getUsage(scopeKey?: string): Record<string, number> {
    ensureScopeLoaded(scopeKey);
    const normalizedScope = normalizeScope(scopeKey);
    return usageByScope.value[normalizedScope] ?? {};
  }

  function track(scopeKey: string | undefined, emoji: string) {
    const currentUsage = getUsage(scopeKey);
    const nextUsage = trackEmojiUsage(currentUsage, emoji);
    const normalizedScope = normalizeScope(scopeKey);
    usageByScope.value[normalizedScope] = nextUsage;
    saveFrequentEmojiUsage(nextUsage, scopeKey);
  }

  function frequentEmojis(scopeKey?: string) {
    return computed(() => {
      return getFrequentEmojis(getUsage(scopeKey), defaultFrequentEmojis, 16);
    });
  }

  return {
    usageByScope,
    ensureScopeLoaded,
    getUsage,
    track,
    frequentEmojis,
  };
});
