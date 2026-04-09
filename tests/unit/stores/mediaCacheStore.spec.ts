import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMediaCacheStore } from "~/stores/mediaCacheStore";

describe("mediaCacheStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("stores resolved URLs and loading flags", () => {
    const mediaCacheStore = useMediaCacheStore();

    mediaCacheStore.setLoading("evt1", true);
    mediaCacheStore.setResolvedUrl("evt1", "blob:test-url");

    expect(mediaCacheStore.isLoading("evt1")).toBe(true);
    expect(mediaCacheStore.getResolvedUrl("evt1")).toBe("blob:test-url");
  });

  it("revokes object URLs on clear", () => {
    const mediaCacheStore = useMediaCacheStore();
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);

    mediaCacheStore.setResolvedUrl("evt1", "blob:test-url");
    mediaCacheStore.clearResolvedUrl("evt1");

    expect(revokeSpy).toHaveBeenCalledWith("blob:test-url");
    expect(mediaCacheStore.getResolvedUrl("evt1")).toBeUndefined();
    revokeSpy.mockRestore();
  });
});
