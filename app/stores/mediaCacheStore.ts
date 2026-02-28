import { ref } from "vue";
import { defineStore } from "pinia";

export const useMediaCacheStore = defineStore("mediaCache", () => {
  const resolvedBlobUrls = ref<Record<string, string>>({});
  const loadingMedia = ref<Record<string, boolean>>({});

  function getResolvedUrl(cacheKey: string): string | undefined {
    return resolvedBlobUrls.value[cacheKey];
  }

  function isLoading(cacheKey: string): boolean {
    return Boolean(loadingMedia.value[cacheKey]);
  }

  function setLoading(cacheKey: string, loading: boolean) {
    loadingMedia.value[cacheKey] = loading;
  }

  function setResolvedUrl(cacheKey: string, resolvedUrl: string) {
    resolvedBlobUrls.value[cacheKey] = resolvedUrl;
  }

  function clearResolvedUrl(cacheKey: string) {
    const url = resolvedBlobUrls.value[cacheKey];
    if (
      url &&
      url.startsWith("blob:") &&
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(url);
    }
    delete resolvedBlobUrls.value[cacheKey];
    delete loadingMedia.value[cacheKey];
  }

  function clearAll() {
    if (
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      for (const resolvedUrl of Object.values(resolvedBlobUrls.value)) {
        if (resolvedUrl.startsWith("blob:")) {
          URL.revokeObjectURL(resolvedUrl);
        }
      }
    }
    resolvedBlobUrls.value = {};
    loadingMedia.value = {};
  }

  return {
    resolvedBlobUrls,
    loadingMedia,
    getResolvedUrl,
    isLoading,
    setLoading,
    setResolvedUrl,
    clearResolvedUrl,
    clearAll,
  };
});
