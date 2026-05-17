const MASK_CHAR = '*'

export function maskSecretForDisplay(secretValue: string): string {
  return MASK_CHAR.repeat(secretValue.length)
}

export type MaskedInputChangeResult = {
  secretValue: string
  cursorPosition: number
}

function clampCursor(position: number, length: number): number {
  return Math.max(0, Math.min(position, length))
}

function replaceRange(
  secretValue: string,
  start: number,
  end: number,
  insertText: string
): MaskedInputChangeResult {
  const nextValue =
    secretValue.slice(0, start) + insertText + secretValue.slice(end)
  const cursorPosition = clampCursor(start + insertText.length, nextValue.length)
  return { secretValue: nextValue, cursorPosition }
}

function deleteRange(
  secretValue: string,
  start: number,
  end: number
): MaskedInputChangeResult {
  const nextValue = secretValue.slice(0, start) + secretValue.slice(end)
  const cursorPosition = clampCursor(start, nextValue.length)
  return { secretValue: nextValue, cursorPosition }
}

/**
 * Applies a masked-field edit from a `beforeinput` event (call after preventDefault).
 */
export function applyMaskedBeforeInputChange(
  secretValue: string,
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
  data: string | null
): MaskedInputChangeResult | null {
  const start = clampCursor(selectionStart, secretValue.length)
  const end = clampCursor(selectionEnd, secretValue.length)
  const hasSelection = start !== end

  if (inputType === 'insertText' || inputType === 'insertCompositionText') {
    if (data === null || data === '') {
      return null
    }
    return replaceRange(secretValue, start, end, data)
  }

  if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
    const pasteText = data ?? ''
    return replaceRange(secretValue, start, end, pasteText)
  }

  if (inputType === 'deleteContentBackward') {
    if (hasSelection) {
      return deleteRange(secretValue, start, end)
    }
    if (start === 0) {
      return null
    }
    return deleteRange(secretValue, start - 1, start)
  }

  if (inputType === 'deleteContentForward') {
    if (hasSelection) {
      return deleteRange(secretValue, start, end)
    }
    if (start >= secretValue.length) {
      return null
    }
    return deleteRange(secretValue, start, start + 1)
  }

  if (inputType === 'deleteByCut') {
    if (!hasSelection) {
      return null
    }
    return deleteRange(secretValue, start, end)
  }

  if (inputType === 'deleteWordBackward') {
    if (hasSelection) {
      return deleteRange(secretValue, start, end)
    }
    const wordStart = findWordBoundaryBackward(secretValue, start)
    return deleteRange(secretValue, wordStart, start)
  }

  if (inputType === 'deleteWordForward') {
    if (hasSelection) {
      return deleteRange(secretValue, start, end)
    }
    const wordEnd = findWordBoundaryForward(secretValue, start)
    return deleteRange(secretValue, start, wordEnd)
  }

  return null
}

function findWordBoundaryBackward(text: string, fromIndex: number): number {
  let index = fromIndex - 1
  while (index > 0 && /\s/.test(text[index] ?? '')) {
    index -= 1
  }
  while (index > 0 && !/\s/.test(text[index - 1] ?? '')) {
    index -= 1
  }
  return index
}

function findWordBoundaryForward(text: string, fromIndex: number): number {
  let index = fromIndex
  while (index < text.length && /\s/.test(text[index] ?? '')) {
    index += 1
  }
  while (index < text.length && !/\s/.test(text[index] ?? '')) {
    index += 1
  }
  return index
}

/**
 * Visible mode: pass through the raw input value.
 */
export function applyVisibleInputChange(
  rawValue: string,
  cursorPosition?: number
): MaskedInputChangeResult {
  const position =
    cursorPosition === undefined
      ? rawValue.length
      : clampCursor(cursorPosition, rawValue.length)
  return { secretValue: rawValue, cursorPosition: position }
}

export function syncMaskedElementDisplay(
  element: HTMLInputElement | HTMLTextAreaElement,
  secretValue: string,
  cursorPosition: number
): void {
  element.value = maskSecretForDisplay(secretValue)
  element.setSelectionRange(cursorPosition, cursorPosition)
}

export function syncVisibleElementDisplay(
  element: HTMLInputElement | HTMLTextAreaElement,
  secretValue: string,
  cursorPosition: number
): void {
  element.value = secretValue
  element.setSelectionRange(cursorPosition, cursorPosition)
}
