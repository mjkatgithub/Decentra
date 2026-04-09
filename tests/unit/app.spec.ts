import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, onMounted, ref } from "vue";
import { mount } from "@vue/test-utils";
import AppRoot from "~/app.vue";

const isSessionRestoreInProgressState = ref(false);
const initializeThemePreferenceMock = vi.fn();
const ensureSessionRestoreCompletedMock = vi.fn(async () => undefined);

vi.mock("~/composables/useThemePreference", () => {
  return {
    useThemePreference: () => ({
      initializeThemePreference: initializeThemePreferenceMock,
    }),
  };
});

vi.mock("~/composables/useAppI18n", () => {
  return {
    useAppI18n: () => ({
      translateText: (key: string) => {
        if (key === "common.loading") {
          return "Loading...";
        }
        return key;
      },
    }),
  };
});

const UAppStub = {
  template: "<div><slot /></div>",
};

const UCardStub = {
  template: "<div><slot /></div>",
};

const UIconStub = {
  template: "<i />",
  props: ["name"],
};

const NuxtRouteAnnouncerStub = {
  template: "<div />",
};

const NuxtPageStub = {
  template: "<div />",
};

describe("app root", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    isSessionRestoreInProgressState.value = false;
    (globalThis as Record<string, unknown>).ref = ref;
    (globalThis as Record<string, unknown>).computed = computed;
    (globalThis as Record<string, unknown>).onMounted = onMounted;
    (globalThis as Record<string, unknown>).useMatrixClient = () => ({
      isSessionRestoreInProgress: isSessionRestoreInProgressState,
      ensureSessionRestoreCompleted: ensureSessionRestoreCompletedMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows startup loading popup while session restore runs", async () => {
    isSessionRestoreInProgressState.value = true;
    const wrapper = mount(AppRoot, {
      global: {
        stubs: {
          UApp: UAppStub,
          UCard: UCardStub,
          UIcon: UIconStub,
          NuxtRouteAnnouncer: NuxtRouteAnnouncerStub,
          NuxtPage: NuxtPageStub,
        },
      },
    });

    await vi.advanceTimersByTimeAsync(800);
    await nextTick();
    expect(wrapper.text()).toContain("Loading...");
  });

  it("hides startup loading popup after startup finishes", async () => {
    isSessionRestoreInProgressState.value = false;
    const wrapper = mount(AppRoot, {
      global: {
        stubs: {
          UApp: UAppStub,
          UCard: UCardStub,
          UIcon: UIconStub,
          NuxtRouteAnnouncer: NuxtRouteAnnouncerStub,
          NuxtPage: NuxtPageStub,
        },
      },
    });

    expect(wrapper.text()).toContain("Loading...");
    await vi.advanceTimersByTimeAsync(800);
    await nextTick();
    expect(wrapper.text()).not.toContain("Loading...");
  });
});
