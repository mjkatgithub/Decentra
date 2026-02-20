import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessageList from '~/components/Chat/MessageList.vue'

describe('MessageList', () => {
  it('shows empty state when there are no messages', () => {
    const wrapper = mount(ChatMessageList, {
      props: {
        messages: []
      }
    })

    wrapper.text().should.include('No messages yet')
  })

  it('renders decryption fallback as warning notice', () => {
    const wrapper = mount(ChatMessageList, {
      props: {
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
      }
    })

    const notice = wrapper.find('p')
    notice.exists().should.equal(true)
    notice.text().should.include('could not be decrypted')
    notice.classes().should.include('border-amber-300')
  })

  it('renders image media with preview url', () => {
    const wrapper = mount(ChatMessageList, {
      props: {
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
      }
    })

    const img = wrapper.find('img')
    img.exists().should.equal(true)
    img.attributes('src').should.equal('http://example.org/thumb.jpg')
    img.attributes('alt').should.equal('photo.jpg')
  })

  it('shows fallback text when media has no display url', () => {
    const wrapper = mount(ChatMessageList, {
      props: {
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
      }
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
      }
    })

    await wrapper.find('img').trigger('click')
    document.body.innerHTML.should.include('Full size')
    wrapper.unmount()
  })
})
