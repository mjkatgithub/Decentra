import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from 'matrix-js-sdk'
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key'

import {
  bootstrapCrossSigningWithRecoveryKeyString,
  mapThrownErrorToRecoveryFailureReason
} from '~/composables/matrix/recoveryKeyBootstrap'

function asMatrixClient(stub: unknown): MatrixClient {
  return stub as MatrixClient
}

describe('mapThrownErrorToRecoveryFailureReason', () => {
  it('maps falsey callback message to invalid_key', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason(
        new Error('getSecretStorageKey callback returned falsey')
      )
    ).toBe('invalid_key')
  })

  it('maps parity error to invalid_key', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason(new Error('Incorrect parity'))
    ).toBe('invalid_key')
  })

  it('maps import failure to invalid_key', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason(
        new Error('importCrossSigningKeys failed to import the keys')
      )
    ).toBe('invalid_key')
  })

  it('maps interactive auth message to uia_required', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason(
        new Error('Interactive authentication required')
      )
    ).toBe('uia_required')
  })

  it('maps session+flows shape to uia_required', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason({
        session: 'abc',
        flows: [{ stages: ['m.login.password'] }]
      })
    ).toBe('uia_required')
  })

  it('maps M_FORBIDDEN errcode to uia_required', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason({ errcode: 'M_FORBIDDEN' })
    ).toBe('uia_required')
  })

  it('maps unknown errors to unknown', () => {
    expect(
      mapThrownErrorToRecoveryFailureReason(new Error('Something else'))
    ).toBe('unknown')
  })
})

describe('bootstrapCrossSigningWithRecoveryKeyString', () => {
  it('returns no_client when client is null', async () => {
    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      null,
      'EsTs RSeQ 7dR3 jKEC qMVw 3yss Qjd6 BfX4 wGmz VQ9k Fnoe A5Gq',
      async () => true
    )
    expect(outcome).toEqual({
      success: false,
      failureReason: 'no_client'
    })
  })

  it('returns invalid_input for whitespace-only input', async () => {
    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      asMatrixClient({}),
      '   \n',
      async () => true
    )
    expect(outcome).toEqual({
      success: false,
      failureReason: 'invalid_input'
    })
  })

  it('returns invalid_key for malformed recovery key', async () => {
    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      asMatrixClient({}),
      'not-a-valid-matrix-recovery-key',
      async () => true
    )
    expect(outcome).toEqual({
      success: false,
      failureReason: 'invalid_key'
    })
  })

  it('returns crypto_unavailable when ensureCryptoReady is false', async () => {
    const fakeKey = new Uint8Array(32)
    fakeKey[0] = 2
    const encoded = encodeRecoveryKey(fakeKey)
    if (!encoded) {
      throw new Error('encodeRecoveryKey returned empty')
    }
    const matrixClientStub = asMatrixClient({})
    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      matrixClientStub,
      encoded,
      async () => false
    )
    expect(outcome).toEqual({
      success: false,
      failureReason: 'crypto_unavailable'
    })
  })

  it('calls bootstrapCrossSigning and restores callbacks', async () => {
    const fakeKey = new Uint8Array(32)
    fakeKey[1] = 9
    const encoded = encodeRecoveryKey(fakeKey)
    if (!encoded) {
      throw new Error('encodeRecoveryKey returned empty')
    }

    const secretCallbacks: { getSecretStorageKey?: unknown } = {}
    const clientCallbacks: { getSecretStorageKey?: unknown } = {}

    const bootstrapCrossSigning = vi.fn(async () => undefined)
    const loadSessionBackupPrivateKeyFromSecretStorage = vi.fn(async () => {
      return undefined
    })
    const isCrossSigningReady = vi.fn(async () => true)
    const getCrossSigningStatus = vi.fn(async () => ({
      publicKeysOnDevice: true,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: {
        masterKey: false,
        selfSigningKey: false,
        userSigningKey: false
      }
    }))

    const matrixClientStub = {
      getCrypto: () => ({
        bootstrapCrossSigning,
        getCrossSigningStatus,
        loadSessionBackupPrivateKeyFromSecretStorage,
        isCrossSigningReady
      }),
      secretStorage: {
        getDefaultKeyId: vi.fn(async () => 'defaultKey'),
        checkKey: vi.fn(async () => true)
      },
      cryptoCallbacks: clientCallbacks
    }

    Object.assign(matrixClientStub.secretStorage, {
      callbacks: secretCallbacks
    })

    const outcome = await bootstrapCrossSigningWithRecoveryKeyString(
      asMatrixClient(matrixClientStub),
      encoded,
      async () => true
    )

    expect(outcome).toEqual({
      success: true,
      crossSigningReady: true
    })
    expect(bootstrapCrossSigning).toHaveBeenCalledWith({})
    expect(loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalled()
    expect(secretCallbacks.getSecretStorageKey).toBeUndefined()
    expect(clientCallbacks.getSecretStorageKey).toBeUndefined()
  })
})
