import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import {
  createComposerTypingNotifier,
  TYPING_IDLE_MS,
  TYPING_REFRESH_MS,
  TYPING_SERVER_TIMEOUT_MS,
} from '~/utils/composerTypingNotifier'

describe('composerTypingNotifier', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends typing true once then false after idle', async () => {
    const sendTyping = vi.fn(async () => ({}))
    const notifier = createComposerTypingNotifier({
      getRoomId: () => '!room:example.org',
      sendTyping,
      isEnabled: () => true,
    })

    notifier.notifyInput()
    await Promise.resolve()

    sendTyping.mock.calls.length.should.equal(1)
    sendTyping.mock.calls[0]!.should.deep.equal([
      '!room:example.org',
      true,
      TYPING_SERVER_TIMEOUT_MS,
    ])

    vi.advanceTimersByTime(TYPING_IDLE_MS)
    await Promise.resolve()

    const falseCalls = sendTyping.mock.calls.filter(
      (call) => call[1] === false,
    )
    falseCalls.length.should.equal(1)
    falseCalls[0]!.should.deep.equal([
      '!room:example.org',
      false,
      TYPING_SERVER_TIMEOUT_MS,
    ])
  })

  it('refreshes typing true without spamming on each keystroke', async () => {
    const sendTyping = vi.fn(async () => ({}))
    const notifier = createComposerTypingNotifier({
      getRoomId: () => '!room:example.org',
      sendTyping,
      isEnabled: () => true,
    })

    notifier.notifyInput()
    await Promise.resolve()
    notifier.notifyInput()
    notifier.notifyInput()
    await Promise.resolve()

    sendTyping.mock.calls.length.should.equal(1)

    vi.advanceTimersByTime(TYPING_REFRESH_MS)
    await Promise.resolve()

    const trueCalls = sendTyping.mock.calls.filter(
      (call) => call[1] === true,
    )
    trueCalls.length.should.equal(2)
  })

  it('notifyStopped sends false immediately', async () => {
    const sendTyping = vi.fn(async () => ({}))
    const notifier = createComposerTypingNotifier({
      getRoomId: () => '!room:example.org',
      sendTyping,
      isEnabled: () => true,
    })

    notifier.notifyInput()
    await Promise.resolve()
    notifier.notifyStopped()
    await Promise.resolve()

    sendTyping.mock.calls.length.should.equal(2)
    sendTyping.mock.calls[1]![1].should.equal(false)
  })

  it('does not send when disabled or room missing', async () => {
    const sendTyping = vi.fn(async () => ({}))
    const notifier = createComposerTypingNotifier({
      getRoomId: () => null,
      sendTyping,
      isEnabled: () => true,
    })

    notifier.notifyInput()
    await Promise.resolve()
    sendTyping.mock.calls.length.should.equal(0)

    const disabledNotifier = createComposerTypingNotifier({
      getRoomId: () => '!room:example.org',
      sendTyping,
      isEnabled: () => false,
    })
    disabledNotifier.notifyInput()
    await Promise.resolve()
    sendTyping.mock.calls.length.should.equal(0)
  })
})
