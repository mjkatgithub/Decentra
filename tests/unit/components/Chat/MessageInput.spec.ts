import { beforeEach, describe, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ChatMessageInput from '~/components/Chat/MessageInput.vue'

const voicePhase = ref<'idle' | 'preview' | 'error'>('idle')
const voicePreviewBlob = ref<Blob | null>(null)
const voicePreviewUrl = ref<string | null>(null)
const voicePreviewDurationMs = ref<number | undefined>(undefined)
const voiceError = ref<{ code: string } | null>(null)
const voiceElapsedMs = ref(0)
const voiceCanPause = ref(false)
const finishSending = vi.fn()
const getPreviewFileName = vi.fn(() => 'voice-message.webm')
const beginRecording = vi.fn(async () => undefined)
const cancelRecording = vi.fn()
const discardPreview = vi.fn()
const markSending = vi.fn()
const markUploadFailed = vi.fn()

vi.mock('~/composables/useVoiceRecorder', () => ({
  useVoiceRecorder: () => ({
    phase: voicePhase,
    error: voiceError,
    elapsedMs: voiceElapsedMs,
    previewBlob: voicePreviewBlob,
    previewUrl: voicePreviewUrl,
    previewDurationMs: voicePreviewDurationMs,
    canPause: voiceCanPause,
    isRecordingActive: ref(false),
    beginRecording,
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording,
    discardPreview,
    markSending,
    markUploadFailed,
    finishSending,
    getPreviewFileName,
  }),
}))

const UInputStub = {
  props: ['modelValue', 'placeholder', 'disabled'],
  emits: ['update:modelValue', 'paste', 'keydown', 'input'],
  template: `
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="
        $emit('update:modelValue', $event.target.value);
        $emit('input', $event)
      "
      @paste="$emit('paste', $event)"
      @keydown="$emit('keydown', $event)"
    >
  `
}

const ChatReactionEmojiPickerStub = {
  emits: ['select'],
  template: `
    <div data-testid="composer-emoji-picker-stub">
      <button
        type="button"
        data-emoji-option="👋"
        @click="$emit('select', '👋')"
      >
        wave
      </button>
    </div>
  `
}

const UButtonStub = {
  props: ['type', 'disabled'],
  emits: ['click'],
  template: `
    <button :type="type || 'button'" :disabled="disabled" @click="$emit('click')">
      <slot />
    </button>
  `
}

function mountInput(
  overrideProps: Partial<{
    roomId: string | null
    disabled: boolean
    threadRootEventId: string | null
    replyTo: {
      eventId: string
      senderName: string
      body: string
    } | null
  }> = {}
) {
  return mount(ChatMessageInput, {
    props: {
      roomId: '!room:example.org',
      disabled: false,
      ...overrideProps
    },
    global: {
      stubs: {
        UInput: UInputStub,
        UButton: UButtonStub,
        ChatReactionEmojiPicker: ChatReactionEmojiPickerStub
      }
    }
  })
}

function defaultMatrixClientStub(
  overrides: Record<string, unknown> = {},
) {
  return {
    client: { value: {} },
    sendMessage: vi.fn(async () => undefined),
    sendEditMessage: vi.fn(async () => undefined),
    sendImageMessage: vi.fn(async () => undefined),
    sendAudioMessage: vi.fn(async () => undefined),
    sendRoomTyping: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('MessageInput', () => {
  beforeEach(() => {
    voicePhase.value = 'idle'
    voicePreviewBlob.value = null
    voicePreviewUrl.value = null
    voicePreviewDurationMs.value = undefined
    voiceError.value = null
    finishSending.mockClear()
    markSending.mockClear()
    markUploadFailed.mockClear()
    beginRecording.mockClear()
    ;(globalThis as Record<string, unknown>).useMatrixClient =
      () => defaultMatrixClientStub()
  })

  it('sends image from file picker', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput()
    const imageFile = new File(['img-data'], 'picked.png', {
      type: 'image/png'
    })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [imageFile],
      configurable: true
    })

    await fileInput.trigger('change')

    sendImageMessage.mock.calls.length.should.equal(1)
    sendImageMessage.mock.calls[0]?.[0].should.equal('!room:example.org')
    sendImageMessage.mock.calls[0]?.[2].should.equal('picked.png')
  })

  it('sends image from clipboard paste', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput()
    const pastedFile = new File(['img-data'], 'pasted.png', {
      type: 'image/png'
    })
    const preventDefault = vi.fn()
    const input = wrapper.find('input[type="text"]')

    await input.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => pastedFile
          }
        ]
      },
      preventDefault
    })

    sendImageMessage.mock.calls.length.should.equal(1)
    preventDefault.mock.calls.length.should.equal(1)
    sendImageMessage.mock.calls[0]?.[2].should.equal('pasted.png')
  })

  it('ignores non-image clipboard data', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput()
    const input = wrapper.find('input[type="text"]')

    await input.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null
          }
        ]
      },
      preventDefault: vi.fn()
    })

    sendImageMessage.mock.calls.length.should.equal(0)
  })

  it('sends reply message with in-reply-to payload', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput({
      replyTo: {
        eventId: 'evt-original',
        senderName: 'Alice',
        body: 'Original message'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Reply text')
    await wrapper.find('form').trigger('submit')

    sendMessage.mock.calls.length.should.equal(1)
    sendMessage.mock.calls[0]?.[0].should.equal('!room:example.org')
    sendMessage.mock.calls[0]?.[1].should.equal('Reply text')
    sendMessage.mock.calls[0]?.[2].eventId.should.equal('evt-original')

    const cancelReplyEvents = wrapper.emitted('cancelReply') || []
    cancelReplyEvents.length.should.equal(1)
  })

  it('emits cancelReply when clicking cancel button', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput({
      replyTo: {
        eventId: 'evt-original',
        senderName: 'Alice',
        body: 'Original message'
      }
    })
    const cancelButton = wrapper.findAll('button')
      .find((buttonWrapper) => {
        return buttonWrapper.text().includes('Cancel reply')
      })
    cancelButton?.exists().should.equal(true)
    await cancelButton?.trigger('click')

    const cancelReplyEvents = wrapper.emitted('cancelReply') || []
    cancelReplyEvents.length.should.equal(1)
  })

  it('sends thread reply with threadRootEventId and replyTo', async () => {
    const sendImageMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendImageMessage })

    const wrapper = mountInput({
      threadRootEventId: '$root-event',
      replyTo: {
        eventId: '$prev',
        senderName: 'Bob',
        body: 'Prior'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Thread line')
    await wrapper.find('form').trigger('submit')

    sendMessage.mock.calls.length.should.equal(1)
    sendMessage.mock.calls[0]?.[2].should.deep.equal({
      threadRootEventId: '$root-event',
      replyTo: { eventId: '$prev' }
    })
  })

  it('prefills and sends edit message with sendEditMessage', async () => {
    const sendEditMessage = vi.fn(async () => undefined)
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage, sendEditMessage })

    const wrapper = mountInput({
      editTo: {
        eventId: 'evt-original',
        body: 'Original text'
      }
    })

    const input = wrapper.find('input[type="text"]')
    ;(input.element as HTMLInputElement).value.should.equal('Original text')
    await input.setValue('Updated text')
    await wrapper.find('form').trigger('submit')

    sendEditMessage.mock.calls.length.should.equal(1)
    sendEditMessage.mock.calls[0]?.[0].should.equal('!room:example.org')
    sendEditMessage.mock.calls[0]?.[1].should.equal('Updated text')
    sendEditMessage.mock.calls[0]?.[2].should.equal('evt-original')

    const cancelEditEvents = wrapper.emitted('cancelEdit') || []
    cancelEditEvents.length.should.equal(1)
  })

  it('emits cancelEdit when clicking cancel edit button', async () => {
    ;(globalThis as Record<string, unknown>).useMatrixClient =
      () => defaultMatrixClientStub()

    const wrapper = mountInput({
      editTo: {
        eventId: 'evt-original',
        body: 'Original text'
      }
    })
    const cancelButton = wrapper.findAll('button')
      .find((buttonWrapper) => {
        return buttonWrapper.text().includes('Cancel edit')
          || buttonWrapper.text().includes('Bearbeitung abbrechen')
      })
    cancelButton?.exists().should.equal(true)
    await cancelButton?.trigger('click')

    const cancelEditEvents = wrapper.emitted('cancelEdit') || []
    cancelEditEvents.length.should.equal(1)
  })

  it('opens picker and inserts emoji without sending', async () => {
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage })

    const wrapper = mountInput()
    await wrapper.get('[data-testid="composer-emoji-button"]').trigger('click')
    wrapper.find('[data-testid="composer-emoji-picker"]').exists().should.equal(
      true
    )
    await wrapper.find('[data-emoji-option="👋"]').trigger('click')

    const input = wrapper.find('input[type="text"]')
    ;(input.element as HTMLInputElement).value.should.equal('👋')
    sendMessage.mock.calls.length.should.equal(0)
  })

  it('autocompletes see_no shortcode with Tab', async () => {
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage })

    const wrapper = mountInput()
    const input = wrapper.find('input[type="text"]')
    await input.setValue('hi :see_no')
    await input.trigger('keydown', { key: 'Tab' })

    ;(input.element as HTMLInputElement).value.should.equal('hi 🙈')
    sendMessage.mock.calls.length.should.equal(0)
  })

  it('does not send when Enter completes autocomplete', async () => {
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage })

    const wrapper = mountInput()
    const input = wrapper.find('input[type="text"]')
    await input.setValue(':wa')
    await input.trigger('keydown', { key: 'Enter' })

    sendMessage.mock.calls.length.should.equal(0)
    ;(input.element as HTMLInputElement).value.should.equal('👋')
  })

  it('normalizes full shortcode on send', async () => {
    const sendMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendMessage })

    const wrapper = mountInput()
    await wrapper.find('input[type="text"]').setValue(':see_no_evil:')
    await wrapper.find('form').trigger('submit')

    sendMessage.mock.calls.length.should.equal(1)
    sendMessage.mock.calls[0]?.[1].should.equal('🙈')
  })

  it('starts voice recording from mic button', async () => {
    const wrapper = mountInput()
    await wrapper.get('[data-testid="composer-voice-button"]').trigger('click')
    beginRecording.mock.calls.length.should.equal(1)
  })

  it('sends voice preview with reply relation', async () => {
    const sendAudioMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendAudioMessage })

    voicePhase.value = 'preview'
    voicePreviewBlob.value = new Blob(['audio'], { type: 'audio/webm' })
    voicePreviewUrl.value = 'blob:preview'
    voicePreviewDurationMs.value = 1500

    const wrapper = mountInput({
      replyTo: {
        eventId: '$reply-target',
        senderName: 'Alice',
        body: 'Hello',
      },
    })

    await wrapper.get('[data-testid="voice-send-button"]').trigger('click')

    sendAudioMessage.mock.calls.length.should.equal(1)
    sendAudioMessage.mock.calls[0]?.[0].should.equal('!room:example.org')
    sendAudioMessage.mock.calls[0]?.[3].should.deep.equal({
      durationMs: 1500,
      replyTo: { eventId: '$reply-target' },
    })
    finishSending.mock.calls.length.should.equal(1)
    const cancelReplyEvents = wrapper.emitted('cancelReply') || []
    cancelReplyEvents.length.should.equal(1)
  })

  it('sends voice preview in thread with thread relation', async () => {
    const sendAudioMessage = vi.fn(async () => undefined)
    ;(globalThis as Record<string, unknown>).useMatrixClient = () =>
      defaultMatrixClientStub({ sendAudioMessage })

    voicePhase.value = 'preview'
    voicePreviewBlob.value = new Blob(['audio'], { type: 'audio/webm' })
    voicePreviewDurationMs.value = 900

    const wrapper = mountInput({
      threadRootEventId: '$thread-root',
      replyTo: {
        eventId: '$in-thread',
        senderName: 'Bob',
        body: 'Thread msg',
      },
    })

    await wrapper.get('[data-testid="voice-send-button"]').trigger('click')

    sendAudioMessage.mock.calls[0]?.[3].should.deep.equal({
      durationMs: 900,
      threadRootEventId: '$thread-root',
      replyTo: { eventId: '$in-thread' },
    })
  })

  it('shows permission denied feedback', async () => {
    voicePhase.value = 'error'
    voiceError.value = { code: 'permissionDenied' }

    const wrapper = mountInput()
    wrapper.find('[data-testid="voice-recorder-error"]').exists().should.equal(
      true
    )
    wrapper.text().should.include('Microphone access was denied')
  })
})
