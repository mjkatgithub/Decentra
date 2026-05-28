import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import ChatMessageList from '~/components/Chat/MessageList.vue'

const canUseHover = ref(false)

vi.mock('~/composables/useHoverCapable', () => ({
  useHoverCapable: () => ({ canUseHover })
}))

const UButtonStub = {
  props: ['type', 'disabled'],
  emits: ['click'],
  template: `
    <button :type="type || 'button'" :disabled="disabled" @click="$emit('click')">
      <slot />
    </button>
  `
}

const ChatMessageActionBarStub = {
  emits: ['reply'],
  template: `
    <button class="action-bar-reply" @click="$emit('reply')">
      Reply
    </button>
  `
}

function mountMessageList(props: Record<string, unknown>) {
  return mount(ChatMessageList, {
    props,
    global: {
      stubs: {
        UButton: UButtonStub,
        ChatMessageActionBar: ChatMessageActionBarStub
      }
    }
  })
}

interface IntersectionObserverRecord {
  callback: IntersectionObserverCallback
}

const intersectionObserverRecords: IntersectionObserverRecord[] = []
const originalIntersectionObserver = globalThis.IntersectionObserver

class IntersectionObserverMock {
  callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    intersectionObserverRecords.push({ callback })
  }

  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

describe('MessageList', () => {
  beforeEach(() => {
    canUseHover.value = false
    intersectionObserverRecords.length = 0
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver
  })

  it('shows empty state when there are no messages', () => {
    const wrapper = mountMessageList({
      messages: []
    })

    wrapper.text().should.include('No messages yet')
  })

  it('renders decryption fallback as warning notice', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt1',
          kind: 'notice',
          isDecryptionError: true,
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Alice sent an encrypted message that could not be decrypted.'
        }
      ]
    })

    const notice = wrapper.find('p')
    notice.exists().should.equal(true)
    notice.text().should.include('could not be decrypted')
    notice.classes().should.include('border-amber-300')
  })

  it('renders image media with preview url', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt2',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'photo.jpg',
          media: {
            url: 'http://example.org/thumb.jpg',
            mxcUrl: 'mxc://example.org/123'
          }
        }
      ]
    })

    const img = wrapper.find('img')
    img.exists().should.equal(true)
    img.attributes('src').should.equal('http://example.org/thumb.jpg')
    img.attributes('alt').should.equal('photo.jpg')
  })

  it('resolves audio playback via blob url', async () => {
    const resolveMediaBlobUrl = vi.fn(async () => 'blob:resolved-audio')
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt_audio',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'track.mp3',
          media: {
            url: '',
            mxcUrl: 'mxc://example.org/audio',
            mimetype: 'audio/mpeg',
          },
        },
      ],
      resolveMediaBlobUrl,
    })

    await flushPromises()

    resolveMediaBlobUrl.mock.calls.length.should.equal(1)
    wrapper.find('[data-testid="voice-play-button"]').exists().should.equal(true)
    wrapper.find('audio').attributes('src').should.equal('blob:resolved-audio')
  })

  it('renders video player for video media messages', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt_video',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'clip.mp4',
          media: {
            url: 'http://example.org/poster.jpg',
            mxcUrl: 'mxc://example.org/thumb',
            mimetype: 'image/jpeg',
            playbackMxcUrl: 'mxc://example.org/video',
            playbackMimetype: 'video/mp4',
          },
        },
      ],
      resolveMediaBlobUrl: async () => 'blob:resolved-video',
    })

    await flushPromises()

    const video = wrapper.find('[data-testid="video-message-element"]')
    video.exists().should.equal(true)
    video.attributes('src').should.equal('blob:resolved-video')
    video.attributes('poster').should.equal('http://example.org/poster.jpg')
  })

  it('shows fallback text when media has no display url', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt3',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'missing-image.jpg',
          media: {
            url: '',
            mxcUrl: 'mxc://example.org/missing',
            mimetype: 'image/jpeg'
          }
        }
      ]
    })

    wrapper.text().should.include('missing-image.jpg')
  })

  it('opens lightbox when clicking image preview', async () => {
    const wrapper = mount(ChatMessageList, {
      attachTo: document.body,
      props: {
        messages: [
          {
            id: 'evt4',
            kind: 'message',
            senderId: '@alice:example.org',
            senderName: 'Alice',
            body: 'photo.jpg',
            media: {
              url: 'http://example.org/thumb.jpg',
              mxcUrl: 'mxc://example.org/123'
            }
          }
        ]
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          ChatMessageActionBar: ChatMessageActionBarStub
        }
      }
    })

    await wrapper.find('img').trigger('click')
    document.body.innerHTML.should.include('Full size')
    wrapper.unmount()
  })

  it('renders reply preview for reply message', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-reply',
          kind: 'message',
          senderId: '@bob:example.org',
          senderName: 'Bob',
          body: 'Reply body',
          replyTo: {
            eventId: 'evt-original',
            senderName: 'Alice',
            body: 'Original message'
          }
        }
      ]
    })

    const preview = wrapper.find('.reply-preview')
    preview.exists().should.equal(true)
    preview.text().should.include('Alice')
    preview.text().should.include('Original message')
  })

  it('emits openReplyTarget when reply quote is activated', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-reply',
          kind: 'message',
          senderId: '@bob:example.org',
          senderName: 'Bob',
          body: 'Reply body',
          replyTo: {
            eventId: 'evt-original',
            senderName: 'Alice',
            body: 'Original message',
            msgtype: 'm.text',
          },
        },
      ],
    })

    const quoteButton = wrapper.find('.reply-preview[role="button"]')
    quoteButton.exists().should.equal(true)
    await quoteButton.trigger('click')

    const jumpEvents = wrapper.emitted('openReplyTarget') || []
    jumpEvents.length.should.equal(1)
    jumpEvents[0]?.[0].should.equal('evt-original')
    wrapper.unmount()
  })

  it('emits reply event when clicking reply action', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-message',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Hello'
        }
      ]
    })

    const replyButton = wrapper.findAll('button')
      .find((buttonWrapper) => buttonWrapper.text().trim() === 'Reply')
    replyButton?.exists().should.equal(true)
    await replyButton?.trigger('click')

    const replyEvents = wrapper.emitted('reply') || []
    replyEvents.length.should.equal(1)
    const firstReplyPayload = replyEvents[0]?.[0] as Record<string, string>
    firstReplyPayload.eventId.should.equal('evt-message')
    firstReplyPayload.senderName.should.equal('Alice')
    firstReplyPayload.body.should.equal('Hello')
  })

  it('adds hover highlight classes to message container', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-hover',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Hover me'
        }
      ]
    })

    const messageContainer = wrapper.find('[data-message-id="evt-hover"]')
    messageContainer.exists().should.equal(true)
    messageContainer.classes().should.include('group')
    messageContainer.classes().should.include('hover-capable:hover:bg-gray-50')
  })

  it('marks a message selected after activate on touch', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-touch',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Tap me'
        }
      ]
    })

    const messageContainer = wrapper.find('[data-message-id="evt-touch"]')
    await messageContainer.trigger('pointerdown', {
      clientX: 10,
      clientY: 10
    })
    await messageContainer.trigger('pointerup', {
      clientX: 12,
      clientY: 11
    })
    await wrapper.vm.$nextTick()

    messageContainer.attributes('data-message-selected').should.equal('true')
    messageContainer.attributes('aria-selected').should.equal('true')
  })

  it('clears selection on Escape', async () => {
    const wrapper = mountMessageList({
      attachTo: document.body,
      messages: [
        {
          id: 'evt-escape',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Escape me'
        }
      ]
    })

    const messageContainer = wrapper.find('[data-message-id="evt-escape"]')
    await messageContainer.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await messageContainer.trigger('pointerup', { clientX: 0, clientY: 0 })
    await wrapper.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    messageContainer.element.hasAttribute('data-message-selected')
      .should.equal(false)
    wrapper.unmount()
  })

  it('clears selection on outside pointerdown', async () => {
    const wrapper = mountMessageList({
      attachTo: document.body,
      messages: [
        {
          id: 'evt-outside',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Outside me'
        }
      ]
    })

    const messageContainer = wrapper.find('[data-message-id="evt-outside"]')
    await messageContainer.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await messageContainer.trigger('pointerup', { clientX: 0, clientY: 0 })
    await wrapper.vm.$nextTick()

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    )
    await wrapper.vm.$nextTick()

    messageContainer.element.hasAttribute('data-message-selected')
      .should.equal(false)
    wrapper.unmount()
  })

  it('emits reachTop when top sentinel intersects', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-scroll-top',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Scroll top'
        }
      ]
    })
    await wrapper.vm.$nextTick()

    const topObserver = intersectionObserverRecords[0]
    intersectionObserverRecords.length.should.be.greaterThan(0)
    topObserver?.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('reachTop') ?? []
    events.length.should.equal(1)
  })

  it('does not emit reachTop while older messages load', async () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 'evt-scroll-guard',
          kind: 'message',
          senderId: '@alice:example.org',
          senderName: 'Alice',
          body: 'Scroll guard'
        }
      ],
      loadingOlder: true
    })

    const topObserver = intersectionObserverRecords[0]
    topObserver?.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('reachTop') ?? []
    events.length.should.equal(0)
  })
})
