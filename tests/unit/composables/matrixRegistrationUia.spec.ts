import { describe, expect, it } from 'vitest'
import {
  buildRecaptchaAuthPayload,
  extractRecaptchaFromParams,
  RECAPTCHA_STAGE
} from '~/composables/matrix/matrixRegistrationUia'

describe('matrixRegistrationUia', () => {
  describe('extractRecaptchaFromParams', () => {
    it('returns site key from Synapse-style params', () => {
      const params: Record<string, unknown> = {
        [RECAPTCHA_STAGE]: {
          public_key: ' pk-test ',
          version: 'v2'
        }
      }
      const parsed = extractRecaptchaFromParams(params)
      expect(parsed?.siteKey).toBe('pk-test')
      expect(parsed?.version).toBe('v2')
    })

    it('defaults to v2 when version omitted', () => {
      const params: Record<string, unknown> = {
        [RECAPTCHA_STAGE]: {
          public_key: 'pk-default'
        }
      }
      expect(extractRecaptchaFromParams(params)?.version).toBe('v2')
    })

    it('detects v3 hint', () => {
      const params: Record<string, unknown> = {
        [RECAPTCHA_STAGE]: {
          public_key: 'pk-v3',
          version: 'v3'
        }
      }
      expect(extractRecaptchaFromParams(params)?.version).toBe('v3')
    })

    it('returns null when block missing', () => {
      expect(extractRecaptchaFromParams({})).toBeNull()
      expect(extractRecaptchaFromParams(undefined)).toBeNull()
    })
  })

  describe('buildRecaptchaAuthPayload', () => {
    it('includes Matrix UIA auth shape', () => {
      const payload = buildRecaptchaAuthPayload('sess-1', 'tok')
      expect(payload).toEqual({
        type: RECAPTCHA_STAGE,
        session: 'sess-1',
        response: 'tok'
      })
    })
  })
})
