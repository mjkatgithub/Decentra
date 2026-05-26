import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VoiceMessagePlayer from '~/components/Chat/VoiceMessagePlayer.vue'

const UButtonStub = {
  props: ['disabled', 'type'],
  emits: ['click'],
  template: `
    <button :disabled="disabled" @click="$emit('click')">
      <slot />
    </button>
  `
}

const UIconStub = {
  template: '<span />'
}

describe('VoiceMessagePlayer', () => {
  it('renders player with play button and duration label', () => {
    const wrapper = mount(VoiceMessagePlayer, {
      props: {
        src: 'blob:voice-preview',
        durationMs: 5000,
        label: 'voice.webm',
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          UIcon: UIconStub,
        },
      },
    })

    wrapper.find('[data-testid="voice-message-player"]').exists().should.equal(true)
    wrapper.find('[data-testid="voice-play-button"]').exists().should.equal(true)
    wrapper.text().should.include('0:00')
    wrapper.text().should.include('0:05')
    wrapper.text().should.include('voice.webm')
  })

  it('shows loading label when loading', () => {
    const wrapper = mount(VoiceMessagePlayer, {
      props: {
        loading: true,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          UIcon: UIconStub,
        },
      },
    })

    wrapper.text().should.include('Loading audio')
  })
})
