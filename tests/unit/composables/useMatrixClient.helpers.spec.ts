import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMatrixSdkMock } from './matrixClientSdkMock'
import {
  setupFreshMatrixClientGlobals,
  setupMatrixClientTestGlobals,
} from './matrixClientTestSetup'

const matrixMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  initCryptoWasm: vi.fn(async () => undefined),
}))

vi.mock('matrix-js-sdk', () => buildMatrixSdkMock(matrixMocks.createClient))
vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
  initAsync: matrixMocks.initCryptoWasm,
}))
vi.mock('~/utils/videoMetadata', () => ({
  readVideoMetadata: vi.fn(async () => ({
    durationMs: 5000,
    w: 640,
    h: 360,
  })),
  captureVideoThumbnail: vi.fn(async () => (
    new Blob(['thumb'], { type: 'image/jpeg' })
  )),
}))

const createClient = matrixMocks.createClient
const initCryptoWasm = matrixMocks.initCryptoWasm

describe('resolveHomeserverBaseUrlForClient', () => {
  it('upgrades http to https for public hostnames', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://matrix.moepg.de')
    ).toBe('https://matrix.moepg.de')
  })

  it('keeps http for localhost', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://localhost:8008')
    ).toBe('http://localhost:8008')
  })

  it('keeps http for private IPv4', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(
      resolveHomeserverBaseUrlForClient('http://192.168.1.5:8080')
    ).toBe('http://192.168.1.5:8080')
  })

  it('defaults scheme to https when omitted', async () => {
    const { resolveHomeserverBaseUrlForClient } =
      await import('~/composables/useMatrixClient')
    expect(resolveHomeserverBaseUrlForClient('matrix.org')).toBe(
      'https://matrix.org'
    )
  })
})

describe('normalizeMatrixUserId / matrix.to helpers', () => {
  it('normalizes localpart with default domain', async () => {
    const { normalizeMatrixUserId } =
      await import('~/composables/useMatrixClient')
    expect(normalizeMatrixUserId('bob', 'example.org')).toBe(
      '@bob:example.org'
    )
    expect(normalizeMatrixUserId('@bob:example.org', 'x')).toBe(
      '@bob:example.org'
    )
  })

  it('throws when domain is missing for localpart-only input', async () => {
    const { normalizeMatrixUserId } =
      await import('~/composables/useMatrixClient')
    expect(() => normalizeMatrixUserId('bob', '')).toThrow()
  })

  it('builds matrix.to link for a user id', async () => {
    const { buildMatrixToUserLink } =
      await import('~/composables/useMatrixClient')
    const link = buildMatrixToUserLink('@alice:example.org')
    expect(link).toContain('matrix.to')
    expect(link).toContain(encodeURIComponent('@alice:example.org'))
  })
})
