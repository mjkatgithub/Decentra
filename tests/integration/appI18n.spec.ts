import { defineComponent, h } from 'vue'
import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useAppI18n } from '~/composables/useAppI18n'

describe('useAppI18n integration', () => {
  it('renders English defaults in a mounted component', () => {
    const DemoComponent = defineComponent({
      setup() {
        const { translateText } = useAppI18n()
        return () => h('p', translateText('auth.signIn'))
      }
    })

    const wrapper = mount(DemoComponent)
    wrapper.text().should.equal('Sign in')
  })
})
