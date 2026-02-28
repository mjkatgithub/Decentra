import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthSessionStore } from "~/stores/authSessionStore";

describe("authSessionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("derives auth status from client ref", () => {
    const authSessionStore = useAuthSessionStore();

    expect(authSessionStore.isLoggedIn).toBe(false);
    authSessionStore.client = {
      getUserId: () => "@alice:example.org",
    } as any;

    expect(authSessionStore.isLoggedIn).toBe(true);
    expect(authSessionStore.userId).toBe("@alice:example.org");
  });

  it("clears session on logout", () => {
    const authSessionStore = useAuthSessionStore();
    localStorage.setItem("decentra.matrix.session.v1", "{}");
    authSessionStore.client = {
      stopClient: () => undefined,
    } as any;

    authSessionStore.logout();

    expect(authSessionStore.client).toBeNull();
    expect(localStorage.getItem("decentra.matrix.session.v1")).toBeNull();
  });
});
