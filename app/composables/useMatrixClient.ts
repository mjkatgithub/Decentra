import {
  createPinia,
  getActivePinia,
  setActivePinia,
  storeToRefs,
} from "pinia";
import { useAuthSessionStore } from "~/stores/authSessionStore";

export function useMatrixClient() {
  if (!getActivePinia()) {
    setActivePinia(createPinia());
  }
  const authSessionStore = useAuthSessionStore();
  return {
    ...authSessionStore,
    ...storeToRefs(authSessionStore),
  };
}
