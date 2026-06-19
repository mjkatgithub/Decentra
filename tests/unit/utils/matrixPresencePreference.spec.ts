import { describe, expect, it, vi } from 'vitest'
import {
  readStoredMatrixPresence,
  setMatrixPresenceWithRetry,
  writeStoredMatrixPresence,
} from '~/utils/matrixPresencePreference'

describe('matrixPresencePreference', () => {
  it('stores and reads presence preference', () => {
    writeStoredMatrixPresence('unavailable')
    readStoredMatrixPresence().should.equal('unavailable')
  })

  it('retries presence updates on rate limit', async () => {
    const setPresence = vi
      .fn()
      .mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))
      .mockResolvedValueOnce(undefined)

    await setMatrixPresenceWithRetry({ setPresence }, 'offline', 3)

    expect(setPresence).toHaveBeenCalledTimes(2)
    expect(setPresence).toHaveBeenCalledWith({ presence: 'offline' })
  })
})
