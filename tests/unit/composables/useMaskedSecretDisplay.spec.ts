import { describe, expect, it } from 'vitest'

import {
  applyMaskedBeforeInputChange,
  applyVisibleInputChange,
  maskSecretForDisplay
} from '~/composables/useMaskedSecretDisplay'

describe('maskSecretForDisplay', () => {
  it('renders one asterisk per character', () => {
    expect(maskSecretForDisplay('')).toBe('')
    expect(maskSecretForDisplay('abc')).toBe('***')
  })
})

describe('applyMaskedBeforeInputChange', () => {
  it('inserts text at cursor', () => {
    const result = applyMaskedBeforeInputChange('ab', 1, 1, 'insertText', 'X')
    expect(result).toEqual({ secretValue: 'aXb', cursorPosition: 2 })
  })

  it('replaces selection on insert', () => {
    const result = applyMaskedBeforeInputChange('abcd', 1, 3, 'insertText', 'Z')
    expect(result).toEqual({ secretValue: 'aZd', cursorPosition: 2 })
  })

  it('deletes backward one character', () => {
    const result = applyMaskedBeforeInputChange(
      'abc',
      2,
      2,
      'deleteContentBackward',
      null
    )
    expect(result).toEqual({ secretValue: 'ac', cursorPosition: 1 })
  })

  it('deletes selection on backward delete', () => {
    const result = applyMaskedBeforeInputChange(
      'abcd',
      1,
      3,
      'deleteContentBackward',
      null
    )
    expect(result).toEqual({ secretValue: 'ad', cursorPosition: 1 })
  })

  it('deletes forward one character', () => {
    const result = applyMaskedBeforeInputChange(
      'abc',
      1,
      1,
      'deleteContentForward',
      null
    )
    expect(result).toEqual({ secretValue: 'ac', cursorPosition: 1 })
  })

  it('pastes over selection', () => {
    const result = applyMaskedBeforeInputChange(
      'ab',
      0,
      2,
      'insertFromPaste',
      'paste'
    )
    expect(result).toEqual({ secretValue: 'paste', cursorPosition: 5 })
  })

  it('returns null for empty insertText', () => {
    expect(
      applyMaskedBeforeInputChange('ab', 1, 1, 'insertText', '')
    ).toBeNull()
  })
})

describe('applyVisibleInputChange', () => {
  it('passes through raw value', () => {
    expect(applyVisibleInputChange('plain')).toEqual({
      secretValue: 'plain',
      cursorPosition: 5
    })
  })
})
