import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, watchEffect } from "vue";
import { mount } from "@vue/test-utils";
import LoginPage from "~/pages/login.vue";

const navigateToMock = vi.fn(async () => undefined);
const loginMock = vi.fn(async () => undefined);
const isLoggedInState = ref(false);
const isSessionRestoreFinishedState = ref(false);

vi.mock("~/stores/authSessionStore", () => {
  return {
    useAuthSessionStore: () => ({
      login: loginMock,
      isLoggedIn: isLoggedInState,
      isSessionRestoreFinished: isSessionRestoreFinishedState,
    }),
  };
});

const UCardStub = {
  template: "<div><slot /><slot name='header' /></div>",
};

const UFormFieldStub = {
  template: "<label><slot /></label>",
  props: ["label"],
};

const UInputStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    "<input :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
};

const UAlertStub = {
  template: "<div><slot /></div>",
};

const UButtonStub = {
  template: "<button><slot /></button>",
  props: ["type", "loading", "to", "block", "variant", "color"],
};

describe("login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoggedInState.value = false;
    isSessionRestoreFinishedState.value = false;
    (globalThis as Record<string, unknown>).ref = ref;
    (globalThis as Record<string, unknown>).watchEffect = watchEffect;
    (globalThis as Record<string, unknown>).navigateTo = navigateToMock;
    (globalThis as Record<string, unknown>).useAppI18n = () => ({
      translateText: (key: string) => key,
    });
  });

  function mountLoginPage() {
    return mount(LoginPage, {
      global: {
        stubs: {
          UCard: UCardStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UAlert: UAlertStub,
          UButton: UButtonStub,
        },
      },
    });
  }

  it("does not redirect before restore finished", async () => {
    isLoggedInState.value = true;
    isSessionRestoreFinishedState.value = false;

    mountLoginPage();
    await Promise.resolve();

    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("redirects to chat when restore finished and logged in", async () => {
    isLoggedInState.value = true;
    isSessionRestoreFinishedState.value = true;

    mountLoginPage();
    await Promise.resolve();

    expect(navigateToMock).toHaveBeenCalledWith("/chat");
  });
});
