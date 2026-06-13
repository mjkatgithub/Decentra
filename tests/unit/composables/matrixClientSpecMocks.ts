import { vi } from 'vitest'
import { buildMatrixSdkMock } from './matrixClientSdkMock'

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
