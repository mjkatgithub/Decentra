import { describe, expect, it } from 'vitest'
import {
  buildRecaptchaAuthPayload,
  buildRegistrationTokenAuthPayload,
  buildTermsAuthPayload,
  extractRecaptchaFromParams,
  extractTermsPoliciesFromParams,
  isRegistrationTokenStage,
  isTermsStage,
  pickCompletableEmailSignupFlow,
  RECAPTCHA_STAGE,
  TERMS_STAGE
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

  describe('buildRegistrationTokenAuthPayload', () => {
    it('sends literal stage id and token field', () => {
      const unstable =
        'org.matrix.msc3915.login.registration_token'
      expect(
        buildRegistrationTokenAuthPayload('s', ' abc ', unstable)
      ).toEqual({
        type: unstable,
        session: 's',
        token: 'abc'
      })
    })
  })

  describe('buildTermsAuthPayload', () => {
    it('only includes type and session', () => {
      expect(
        buildTermsAuthPayload('sess', TERMS_STAGE)
      ).toEqual({
        type: TERMS_STAGE,
        session: 'sess'
      })
    })
  })

  describe('isRegistrationTokenStage', () => {
    it('accepts stable id and unstable suffix', () => {
      expect(isRegistrationTokenStage('m.login.registration_token'))
        .toBe(true)
      expect(
        isRegistrationTokenStage('org.x.login.registration_token')
      ).toBe(true)
      expect(isRegistrationTokenStage('m.login.dummy')).toBe(false)
    })
  })

  describe('isTermsStage', () => {
    it('accepts stable identifier', () => {
      expect(isTermsStage(TERMS_STAGE)).toBe(true)
      expect(isTermsStage('org.x.login.terms')).toBe(true)
    })
  })

  describe('extractTermsPoliciesFromParams', () => {
    it('picks preferred locale and parses policy map', () => {
      const rows = extractTermsPoliciesFromParams(
        {
          [TERMS_STAGE]: {
            policies: {
              tos: {
                version: '1',
                en: {
                  name: 'ToS',
                  url: 'https://example.org/tos'
                }
              }
            }
          }
        },
        ['en', 'de']
      )
      expect(rows).toEqual([
        expect.objectContaining({
          policyId: 'tos',
          name: 'ToS',
          url: 'https://example.org/tos',
          version: '1'
        })
      ])
    })
  })

  describe('pickCompletableEmailSignupFlow', () => {
    it('prefers shortest completable email-UIF flow', () => {
      const result = pickCompletableEmailSignupFlow([
        { stages: ['m.login.recaptcha', 'm.login.email.identity'] },
        { stages: ['m.login.email.identity', 'm.login.dummy'] }
      ])
      expect(result).toEqual({
        ok: true,
        stages: ['m.login.email.identity', 'm.login.dummy']
      })
    })

    it('rejects when only SSO email paths exist', () => {
      const result = pickCompletableEmailSignupFlow([
        { stages: ['m.login.sso', 'm.login.email.identity'] }
      ])
      expect(result).toEqual({ ok: false, reason: 'sso_only' })
    })
  })
})
