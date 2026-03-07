import { storeToRefs } from "pinia";
import { useAuthSessionStore } from "~/stores/authSessionStore";

export function useMatrixClient() {
  const authSessionStore = useAuthSessionStore();
  return {
    ...authSessionStore,
    ...storeToRefs(authSessionStore),
  };
}
