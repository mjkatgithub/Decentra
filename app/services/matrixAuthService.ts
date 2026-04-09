import type { MatrixClient } from "matrix-js-sdk";
import { initAsync as initCryptoWasm } from "@matrix-org/matrix-sdk-crypto-wasm";

export interface StoredMatrixSession {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

export interface StoredMatrixDevice {
  baseUrl: string;
  userId: string;
  deviceId: string;
}

const MATRIX_SESSION_STORAGE_KEY = "decentra.matrix.session.v1";
const MATRIX_DEVICE_STORAGE_KEY = "decentra.matrix.device.v1";
let cryptoWasmInitialization: Promise<void> | null = null;

function extractUserLocalpart(userIdOrUsername: string): string {
  const normalized = userIdOrUsername.trim().toLowerCase();
  const withoutAtPrefix = normalized.startsWith("@")
    ? normalized.slice(1)
    : normalized;
  return withoutAtPrefix.split(":")[0] ?? withoutAtPrefix;
}

function normalizeHomeserver(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/g, "");
  }
}

function isSameHomeserver(left: string, right: string): boolean {
  return normalizeHomeserver(left) === normalizeHomeserver(right);
}

function isCryptoStoreAccountMismatch(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("account in the store doesn't match") ||
    message.includes("account in the store doesn\\'t match")
  );
}

function deleteIndexedDb(databaseName: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearRustCryptoStores(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const databaseNames = new Set<string>(["matrix-js-sdk::matrix-sdk-crypto"]);
  const indexedDbFactory = window.indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof indexedDbFactory.databases === "function") {
    try {
      const databases = await indexedDbFactory.databases();
      for (const database of databases) {
        const databaseName = database.name ?? "";
        if (databaseName.includes("matrix-sdk-crypto")) {
          databaseNames.add(databaseName);
        }
      }
    } catch {
      // Continue with known fallback DB names.
    }
  }

  for (const databaseName of databaseNames) {
    await deleteIndexedDb(databaseName);
  }
}

async function ensureCryptoWasmInitialized(): Promise<void> {
  if (!cryptoWasmInitialization) {
    cryptoWasmInitialization = initCryptoWasm().catch((error) => {
      cryptoWasmInitialization = null;
      throw error;
    });
  }
  await cryptoWasmInitialization;
}

export function readStoredSession(): StoredMatrixSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawSession = localStorage.getItem(MATRIX_SESSION_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }
  try {
    const parsedSession = JSON.parse(rawSession) as StoredMatrixSession;
    if (!parsedSession.baseUrl || !parsedSession.accessToken || !parsedSession.userId) {
      return null;
    }
    return parsedSession;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredMatrixSession): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(MATRIX_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(MATRIX_SESSION_STORAGE_KEY);
}

export function readStoredDevice(): StoredMatrixDevice | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawStoredDevice = localStorage.getItem(MATRIX_DEVICE_STORAGE_KEY);
  if (!rawStoredDevice) {
    return null;
  }
  try {
    const parsedStoredDevice = JSON.parse(rawStoredDevice) as StoredMatrixDevice;
    if (
      !parsedStoredDevice.baseUrl ||
      !parsedStoredDevice.userId ||
      !parsedStoredDevice.deviceId
    ) {
      return null;
    }
    return parsedStoredDevice;
  } catch {
    return null;
  }
}

export function writeStoredDevice(device: StoredMatrixDevice): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(MATRIX_DEVICE_STORAGE_KEY, JSON.stringify(device));
}

export function shouldReuseStoredDeviceId(
  storedSession: StoredMatrixSession | null,
  storedDevice: StoredMatrixDevice | null,
  baseUrl: string,
  username: string,
): boolean {
  const sessionDevice = storedSession?.deviceId;
  const sessionUserId = storedSession?.userId;
  const sessionBaseUrl = storedSession?.baseUrl;
  const fallbackDevice = storedDevice?.deviceId;
  const fallbackUserId = storedDevice?.userId;
  const fallbackBaseUrl = storedDevice?.baseUrl;
  const candidateDeviceId = sessionDevice || fallbackDevice;
  const candidateUserId = sessionUserId || fallbackUserId;
  const candidateBaseUrl = sessionBaseUrl || fallbackBaseUrl;

  if (!candidateDeviceId || !candidateUserId || !candidateBaseUrl) {
    return false;
  }
  if (!isSameHomeserver(candidateBaseUrl, baseUrl)) {
    return false;
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (normalizedUsername.startsWith("@")) {
    return candidateUserId.toLowerCase() === normalizedUsername;
  }
  return (
    extractUserLocalpart(candidateUserId) ===
    extractUserLocalpart(normalizedUsername)
  );
}

export async function initRustCryptoWithRecovery(
  matrixClient: MatrixClient,
  context: string,
): Promise<boolean> {
  try {
    await ensureCryptoWasmInitialized();
    await matrixClient.initRustCrypto();
    return true;
  } catch (error) {
    if (!isCryptoStoreAccountMismatch(error)) {
      console.error(`Failed to initialize Rust crypto ${context}`, error);
      return false;
    }
    console.warn("Crypto store mismatch detected; resetting local crypto stores");
    try {
      await matrixClient.clearStores();
    } catch {
      // clearStores can fail if store does not exist yet.
    }
    await clearRustCryptoStores();
    try {
      await ensureCryptoWasmInitialized();
      await matrixClient.initRustCrypto();
      return true;
    } catch (retryError) {
      console.error(
        `Failed to initialize Rust crypto ${context} after store reset`,
        retryError,
      );
      return false;
    }
  }
}
