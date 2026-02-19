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

  it('renders image message when media is present', () => {
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
              url: 'http://example.org/thumb.jpg'
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
})
