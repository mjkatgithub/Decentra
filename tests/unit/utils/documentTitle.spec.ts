import { describe, expect, it } from 'vitest'
import {
  buildDocumentTitlePrefix,
  formatDocumentTitle,
  stripDocumentTitlePrefix,
} from '~/utils/documentTitle'

describe('documentTitle', () => {
  it('strips stacked legacy prefixes', () => {
    expect(stripDocumentTitlePrefix('(1 @) (1 @) Decentra')).toBe('Decentra')
  })

  it('strips combined unread and mention prefixes', () => {
    expect(stripDocumentTitlePrefix('(3 · 1 @) Decentra')).toBe('Decentra')
  })

  it('strips the simple unread marker', () => {
    expect(stripDocumentTitlePrefix('(*) (*) Decentra')).toBe('Decentra')
  })

  it('builds a boolean unread prefix', () => {
    expect(buildDocumentTitlePrefix(true)).toBe('(*)')
    expect(buildDocumentTitlePrefix(false)).toBeNull()
  })

  it('formats the final document title', () => {
    expect(formatDocumentTitle('Decentra', true)).toBe('(*) Decentra')
    expect(formatDocumentTitle('Decentra', false)).toBe('Decentra')
  })
})
