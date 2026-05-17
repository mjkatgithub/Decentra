import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MaskedSecretInput from '~/components/auth/MaskedSecretInput.vue'

vi.mock('~/composables/useAppI18n', () => ({
  useAppI18n: () => ({
    translateText: (key: string) => key
  })
}))

const UInputStub = {
  props: [
    'modelValue',
    'id',
    'placeholder',
    'disabled',
    'required',
    'autocomplete',
    'type'
  ],
  emits: ['beforeinput', 'input'],
  template: `
    <div class="w-full">
      <input
        :id="id"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :type="type || 'text'"
        @beforeinput="$emit('beforeinput', $event)"
        @input="$emit('input', $event)"
      />
      <slot name="trailing" />
    </div>
  `
}

const UIconStub = {
  props: ['name'],
  template: '<span class="icon-stub" />'
}

function mountMasked(
  props: Partial<{
    modelValue: string
    secretKind: 'password' | 'recoveryKey'
    multiline: boolean
  }> = {}
) {
  return mount(MaskedSecretInput, {
    props: {
      modelValue: props.modelValue ?? '',
      secretKind: props.secretKind ?? 'password',
      multiline: props.multiline ?? false,
      'onUpdate:modelValue': () => undefined
    },
    global: {
      stubs: {
        UInput: UInputStub,
        UIcon: UIconStub
      }
    }
  })
}

describe('MaskedSecretInput', () => {
  it('masks display value by default', async () => {
    const wrapper = mountMasked({ modelValue: 'ab' })
    await nextTick()
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('**')
  })

  it('toggles visibility on button press', async () => {
    const wrapper = mountMasked({ modelValue: 'ab' })
    await nextTick()
    const toggle = wrapper.find('button')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('auth.secretShowPassword')

    await toggle.trigger('mousedown')
    await nextTick()

    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('ab')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('auth.secretHidePassword')
  })

  it('uses recovery key labels when secretKind is recoveryKey', async () => {
    const wrapper = mountMasked({
      modelValue: '',
      secretKind: 'recoveryKey'
    })
    await nextTick()
    const toggle = wrapper.find('button')
    expect(toggle.attributes('aria-label')).toBe(
      'settings.secretShowRecoveryKey'
    )
  })

  it('renders textarea when multiline', () => {
    const wrapper = mountMasked({ multiline: true })
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('emits update when typing in visible mode', async () => {
    const wrapper = mount(MaskedSecretInput, {
      props: {
        modelValue: '',
        secretKind: 'password'
      },
      global: {
        stubs: {
          UInput: UInputStub,
          UIcon: UIconStub
        }
      }
    })
    await wrapper.find('button').trigger('mousedown')
    await nextTick()
    const input = wrapper.find('input')
    await input.setValue('secret')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['secret'])
  })
})
