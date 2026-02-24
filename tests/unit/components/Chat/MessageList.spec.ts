import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessageList from '~/components/Chat/MessageList.vue'

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

describe('MessageList', () => {
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
    messageContainer.classes().should.include('hover:bg-gray-50')
  })
})
