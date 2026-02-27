<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  categoryOrder,
  createShortcodeMap,
  defaultFrequentEmojis,
  emojiCatalog,
  getFrequentEmojis,
  loadFrequentEmojiUsage,
  normalizeShortcodes,
  saveFrequentEmojiUsage,
  trackEmojiUsage,
  type EmojiCategoryId,
} from "~/composables/useEmojiPickerData";

const emit = defineEmits<{
  select: [emoji: string];
}>();
const props = defineProps<{
  frequentScopeKey?: string;
}>();

const activeCategory = ref<EmojiCategoryId>("frequent");
const searchTerm = ref("");
const customEmoji = ref("");
const frequentUsage = ref<Record<string, number>>({});
const shortcodeToEmoji = createShortcodeMap(emojiCatalog);

watch(
  () => props.frequentScopeKey,
  (scopeKey) => {
    frequentUsage.value = loadFrequentEmojiUsage(scopeKey);
  },
  { immediate: true }
);

const frequentEmojis = computed(() => {
  return getFrequentEmojis(frequentUsage.value, defaultFrequentEmojis, 16);
});

function selectEmoji(emoji: string) {
  frequentUsage.value = trackEmojiUsage(frequentUsage.value, emoji);
  saveFrequentEmojiUsage(frequentUsage.value, props.frequentScopeKey);
  emit("select", emoji);
}

function addFromInput() {
  const normalizedInput = normalizeShortcodes(
    customEmoji.value,
    shortcodeToEmoji
  ).trim();
  if (!normalizedInput) {
    return;
  }
  selectEmoji(normalizedInput);
  customEmoji.value = "";
}

const filteredEntries = computed(() => {
  const normalizedQuery = searchTerm.value.trim().toLowerCase();
  if (!normalizedQuery) {
    return emojiCatalog;
  }
  return emojiCatalog.filter((emojiEntry) => {
    if (emojiEntry.emoji.includes(normalizedQuery)) {
      return true;
    }
    if (emojiEntry.name.includes(normalizedQuery)) {
      return true;
    }
    if (
      emojiEntry.shortcodes.some((shortcode) => {
        return shortcode.includes(normalizedQuery);
      })
    ) {
      return true;
    }
    return emojiEntry.keywords.some((keyword) => {
      return keyword.includes(normalizedQuery);
    });
  });
});

const sections = computed(() => {
  const entries = filteredEntries.value;
  if (searchTerm.value.trim()) {
    return categoryOrder
      .filter((category) => category.id !== "frequent")
      .map((category) => {
        return {
          ...category,
          emojis: entries.filter((emojiEntry) => {
            return emojiEntry.category === category.id;
          }),
        };
      })
      .filter((section) => section.emojis.length > 0);
  }

  if (activeCategory.value === "frequent") {
    return [
      {
        id: "frequent",
        label: "Quick Reactions",
        icon: "🕘",
        emojis: frequentEmojis.value.map((emoji) => ({ emoji })),
      },
    ];
  }

  const category = categoryOrder.find((item) => item.id === activeCategory.value);
  if (!category) {
    return [];
  }
  return [
    {
      ...category,
      emojis: entries.filter((emojiEntry) => {
        return emojiEntry.category === category.id;
      }),
    },
  ];
});
</script>

<template>
  <div
    class="
      mt-1 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-xl
      dark:border-gray-700 dark:bg-gray-900
    "
  >
    <div
      class="
        mb-2 flex items-center gap-1 border-b border-gray-200 pb-1
        dark:border-gray-700
      "
    >
      <button
        v-for="category in categoryOrder"
        :key="category.id"
        type="button"
        :title="category.label"
        class="rounded p-1.5 text-sm transition-colors"
        :class="
          activeCategory === category.id
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            : `
              text-gray-500 hover:bg-gray-100 hover:text-gray-800
              dark:text-gray-300 dark:hover:bg-gray-800
              dark:hover:text-gray-100
            `
        "
        @click="activeCategory = category.id"
      >
        {{ category.icon }}
      </button>
    </div>

    <div class="mb-2">
      <input
        v-model="searchTerm"
        type="text"
        placeholder="Search"
        class="
          w-full rounded-md border border-gray-200 bg-white px-3 py-1.5
          text-sm dark:border-gray-600 dark:bg-gray-800
        "
      />
    </div>

    <div class="max-h-56 space-y-2 overflow-y-auto pr-1">
      <section
        v-for="section in sections"
        :key="section.id"
      >
        <p class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
          {{ section.label }}
        </p>
        <div class="grid grid-cols-8 gap-1">
          <button
            v-for="emojiEntry in section.emojis"
            :key="emojiEntry.emoji"
            type="button"
            class="
              rounded p-1 text-lg transition-colors hover:bg-gray-100
              dark:hover:bg-gray-800
            "
            :data-emoji-option="emojiEntry.emoji"
            @click="selectEmoji(emojiEntry.emoji)"
          >
            {{ emojiEntry.emoji }}
          </button>
        </div>
      </section>
    </div>

    <div
      class="
        mt-2 flex items-center gap-1 border-t border-gray-200 pt-2
        dark:border-gray-700
      "
    >
      <input
        v-model="customEmoji"
        type="text"
        placeholder="Any emoji or :wave:"
        class="
          w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs
          dark:border-gray-600 dark:bg-gray-800
        "
        @keydown.enter.prevent="addFromInput"
      />
      <button
        type="button"
        class="
          rounded px-2 py-1 text-xs font-semibold text-blue-600
          hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40
        "
        @click="addFromInput"
      >
        Add
      </button>
    </div>
  </div>
</template>
