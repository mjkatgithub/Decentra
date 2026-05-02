import { describe, expect, it } from 'vitest'
import {
  isPublicRegisterEndpointDisabled,
  isTransportFailureWithoutMatrixBody
} from '~/composables/matrix/matrixClientShared'

describe('matrixClientShared', () => {
  describe('isTransportFailureWithoutMatrixBody', () => {
    it('maps plain fetch-style failures', () => {
      expect(
        isTransportFailureWithoutMatrixBody(new TypeError('Failed to fetch'))
      ).toBe(true)
      expect(
        isTransportFailureWithoutMatrixBody(new Error('Load failed'))
      ).toBe(true)
    })

    it('does not treat Matrix API errors as transport-only failures', () => {
      const withErrcode = Object.assign(new Error('Failed to fetch'), {
        errcode: 'M_BAD_JSON',
        data: { error: 'Not JSON' }
      })
      expect(isTransportFailureWithoutMatrixBody(withErrcode)).toBe(false)
    })

    it('respects HTTP status on the SDK error shape', () => {
      const withStatus = Object.assign(new Error('NetworkError'), {
        httpStatus: 502
      })
      expect(isTransportFailureWithoutMatrixBody(withStatus)).toBe(false)
    })
  })

  describe('isPublicRegisterEndpointDisabled', () => {
    it('detects matrix.org-style forbidden register response body', () => {
      expect(
        isPublicRegisterEndpointDisabled({
          httpStatus: 403,
          errcode: 'M_FORBIDDEN',
          data: {
            errcode: 'M_FORBIDDEN',
            error:
              'Registration has been disabled. ' +
              'Only m.login.application_service registrations are allowed.'
          }
        })
      ).toBe(true)
    })

    it('detects synonym disabled copy', () => {
      expect(
        isPublicRegisterEndpointDisabled({
          error: 'Registration is disabled for this homeserver.'
        })
      ).toBe(true)
    })

    it('returns false for unrelated forbidden errors', () => {
      expect(
        isPublicRegisterEndpointDisabled({
          errcode: 'M_FORBIDDEN',
          data: {
            error: 'User ID already taken'
          }
        })
      ).toBe(false)
    })

    it('returns false when error shape is unknown', () => {
      expect(isPublicRegisterEndpointDisabled(undefined)).toBe(false)
      expect(isPublicRegisterEndpointDisabled(null)).toBe(false)
      expect(isPublicRegisterEndpointDisabled('no')).toBe(false)
    })
  })
})
