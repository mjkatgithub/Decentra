import { onBeforeUnmount, onMounted, ref } from "vue";

export const HOVER_CAPABLE_MEDIA_QUERY =
  "(hover: hover) and (pointer: fine)";

export function readHoverCapableFromWindow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(HOVER_CAPABLE_MEDIA_QUERY).matches;
}

export function useHoverCapable() {
  const canUseHover = ref(readHoverCapableFromWindow());

  function syncFromMediaQuery() {
    canUseHover.value = readHoverCapableFromWindow();
  }

  let mediaQueryList: MediaQueryList | null = null;

  onMounted(() => {
    if (typeof window === "undefined") {
      return;
    }
    mediaQueryList = window.matchMedia(HOVER_CAPABLE_MEDIA_QUERY);
    syncFromMediaQuery();
    mediaQueryList.addEventListener("change", syncFromMediaQuery);
  });

  onBeforeUnmount(() => {
    if (!mediaQueryList) {
      return;
    }
    mediaQueryList.removeEventListener("change", syncFromMediaQuery);
    mediaQueryList = null;
  });

  return {
    canUseHover,
  };
}
