import { describe, expect, it } from 'vitest'
import {
  isInteractiveMessageRowTarget,
  isWithinMessageRowTapThreshold,
  MESSAGE_ROW_TAP_MOVE_THRESHOLD_PX
} from '~/utils/messageRowPointer'

describe('messageRowPointer', () => {
  it('accepts taps within the movement threshold', () => {
    expect(
      isWithinMessageRowTapThreshold(0, 0, 5, 5, MESSAGE_ROW_TAP_MOVE_THRESHOLD_PX)
    ).to.equal(true)
  })

  it('rejects movement beyond the threshold', () => {
    expect(
      isWithinMessageRowTapThreshold(
        0,
        0,
        MESSAGE_ROW_TAP_MOVE_THRESHOLD_PX + 5,
        0
      )
    ).to.equal(false)
  })

  it('detects interactive targets inside a message row', () => {
    document.body.innerHTML = `
      <div data-message-id="evt-1">
        <button type="button" id="reply-btn">Reply</button>
      </div>
    `
    const button = document.getElementById('reply-btn')
    expect(isInteractiveMessageRowTarget(button)).to.equal(true)
    document.body.innerHTML = ''
  })

  it('allows activation on non-interactive row content', () => {
    document.body.innerHTML = `
      <div data-message-id="evt-1">
        <p id="body-text">Hello</p>
      </div>
    `
    const paragraph = document.getElementById('body-text')
    expect(isInteractiveMessageRowTarget(paragraph)).to.equal(false)
    document.body.innerHTML = ''
  })
})
