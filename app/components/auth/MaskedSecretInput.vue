<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { authFormInputUi } from '~/constants/authFormInputUi'
import { useAppI18n } from '~/composables/useAppI18n'
import {
  applyMaskedBeforeInputChange,
  applyVisibleInputChange,
  maskSecretForDisplay,
  syncMaskedElementDisplay,
  syncVisibleElementDisplay
} from '~/composables/useMaskedSecretDisplay'

export type MaskedSecretKind = 'password' | 'recoveryKey'

const props = withDefaults(
  defineProps<{
    modelValue: string
    secretKind?: MaskedSecretKind
    multiline?: boolean
    rows?: number
    autocomplete?: string
    required?: boolean
    placeholder?: string
    disabled?: boolean
    id?: string
  }>(),
  {
    secretKind: 'password',
    multiline: false,
    rows: 3,
    autocomplete: undefined,
    required: false,
    placeholder: undefined,
    disabled: false,
    id: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { translateText } = useAppI18n()
const isVisible = ref(false)
const inputWrapperRef = ref<{ $el: HTMLElement } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const textareaClass = computed(() => {
  return (
    'w-full rounded-md border-0 appearance-none px-2.5 py-1.5 ' +
    'text-base/5 text-highlighted bg-elevated ring ring-inset ring-accented ' +
    'placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed ' +
    'disabled:opacity-75 pr-10 font-mono text-xs resize-y'
  )
})

const toggleLabel = computed(() => {
  if (props.secretKind === 'recoveryKey') {
    return isVisible.value
      ? translateText('settings.secretHideRecoveryKey')
      : translateText('settings.secretShowRecoveryKey')
  }
  return isVisible.value
    ? translateText('auth.secretHidePassword')
    : translateText('auth.secretShowPassword')
})

const toggleIcon = computed(() => {
  return isVisible.value ? 'i-lucide-eye-off' : 'i-lucide-eye'
})

const toggleButtonClass = computed(() => {
  const base =
    'inline-flex shrink-0 items-center justify-center rounded-md ' +
    'border-0 bg-transparent p-1.5 shadow-none text-dimmed ' +
    'hover:bg-transparent hover:text-default ' +
    'focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-primary/40 disabled:cursor-not-allowed ' +
    'disabled:opacity-50'
  return props.multiline ? `absolute right-2 top-2 ${base}` : base
})

const displayValue = computed(() => {
  return isVisible.value
    ? props.modelValue
    : maskSecretForDisplay(props.modelValue)
})

function resolveFieldElement(): HTMLInputElement | HTMLTextAreaElement | null {
  if (props.multiline) {
    return textareaRef.value
  }
  const wrapper = inputWrapperRef.value
  if (!wrapper) {
    return null
  }
  const root = wrapper.$el
  if (!root) {
    return null
  }
  if (root instanceof HTMLInputElement) {
    return root
  }
  return root.querySelector('input')
}

function emitSecretValue(nextValue: string) {
  emit('update:modelValue', nextValue)
}

function syncDisplay(cursorPosition?: number) {
  const element = resolveFieldElement()
  if (!element) {
    return
  }
  const position =
    cursorPosition === undefined
      ? props.modelValue.length
      : cursorPosition
  if (isVisible.value) {
    syncVisibleElementDisplay(element, props.modelValue, position)
  } else {
    syncMaskedElementDisplay(element, props.modelValue, position)
  }
}

watch(
  () => props.modelValue,
  () => {
    nextTick(() => {
      syncDisplay()
    })
  }
)

watch(isVisible, () => {
  nextTick(() => {
    syncDisplay()
  })
})

onMounted(() => {
  nextTick(() => {
    syncDisplay()
  })
})

function onBeforeInput(event: InputEvent) {
  if (isVisible.value || props.disabled) {
    return
  }
  const element = resolveFieldElement()
  if (!element) {
    return
  }
  const inputType = event.inputType
  const supportedTypes = new Set([
    'insertText',
    'insertCompositionText',
    'insertFromPaste',
    'insertFromDrop',
    'deleteContentBackward',
    'deleteContentForward',
    'deleteByCut',
    'deleteWordBackward',
    'deleteWordForward'
  ])
  if (!supportedTypes.has(inputType)) {
    return
  }
  event.preventDefault()
  const change = applyMaskedBeforeInputChange(
    props.modelValue,
    element.selectionStart ?? 0,
    element.selectionEnd ?? 0,
    inputType,
    event.data
  )
  if (!change) {
    return
  }
  emitSecretValue(change.secretValue)
  nextTick(() => {
    syncMaskedElementDisplay(
      element,
      change.secretValue,
      change.cursorPosition
    )
  })
}

function onInput(event: Event) {
  const element = event.target as HTMLInputElement | HTMLTextAreaElement
  if (isVisible.value) {
    const change = applyVisibleInputChange(
      element.value,
      element.selectionStart ?? element.value.length
    )
    emitSecretValue(change.secretValue)
    return
  }
  const maskedExpected = maskSecretForDisplay(props.modelValue)
  if (element.value !== maskedExpected) {
    const change = applyVisibleInputChange(
      element.value,
      element.value.length
    )
    emitSecretValue(change.secretValue)
    nextTick(() => {
      syncMaskedElementDisplay(
        element,
        change.secretValue,
        change.cursorPosition
      )
    })
  }
}

function onToggleVisibility(event: MouseEvent) {
  event.preventDefault()
  const cursorAtEnd = props.modelValue.length
  isVisible.value = !isVisible.value
  nextTick(() => {
    syncDisplay(cursorAtEnd)
    resolveFieldElement()?.focus()
  })
}
</script>

<template>
  <UInput
    v-if="!multiline"
    :id="id"
    ref="inputWrapperRef"
    type="text"
    class="w-full"
    :ui="authFormInputUi"
    :model-value="displayValue"
    :autocomplete="autocomplete"
    :required="required"
    :placeholder="placeholder"
    :disabled="disabled"
    spellcheck="false"
    autocapitalize="off"
    @beforeinput="onBeforeInput"
    @input="onInput"
  >
    <template #trailing>
      <button
        type="button"
        :class="toggleButtonClass"
        :aria-label="toggleLabel"
        :aria-pressed="isVisible"
        :disabled="disabled"
        @mousedown.prevent="onToggleVisibility"
      >
        <UIcon :name="toggleIcon" class="size-5 shrink-0" />
      </button>
    </template>
  </UInput>
  <div
    v-else
    class="relative w-full"
  >
    <textarea
      :id="id"
      ref="textareaRef"
      :value="displayValue"
      :rows="rows"
      :class="textareaClass"
      :autocomplete="autocomplete"
      :required="required"
      :placeholder="placeholder"
      :disabled="disabled"
      spellcheck="false"
      autocapitalize="off"
      @beforeinput="onBeforeInput"
      @input="onInput"
    />
    <button
      type="button"
      :class="toggleButtonClass"
      :aria-label="toggleLabel"
      :aria-pressed="isVisible"
      :disabled="disabled"
      @mousedown.prevent="onToggleVisibility"
    >
      <UIcon :name="toggleIcon" class="size-5 shrink-0" />
    </button>
  </div>
</template>
