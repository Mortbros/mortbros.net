<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { VCombobox } from 'vuetify/components';

const props = defineProps<{
  modelValue: string;
  label: string;
  suggestions: string[];
  onNext?: () => void;
  onPrevious?: () => void;
  required?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const inputRef = ref<InstanceType<typeof VCombobox> | null>(null);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val || '')
});

const focus = async () => {
  await nextTick();
  const input = inputRef.value?.$el.querySelector('input') as HTMLInputElement;
  if (input) {
    input.focus();
    await nextTick();
    input.select();
  }
};

const capitalize = () => {
  if (value.value && /^[a-z]/.test(value.value)) {
    const capitalized = value.value.charAt(0).toUpperCase() + value.value.slice(1);
    value.value = capitalized;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    // Ctrl+Enter: Allow default behavior (submit/select)
    return;
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    props.onNext?.();
  } else if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    props.onPrevious?.();
  }
};

const handleValueUpdate = (newValue: string) => {
  // Don't capitalize immediately - let autocomplete work first
  value.value = newValue || '';
};

// Capitalization removed - user can capitalize manually or use button
const handleBlur = () => {
  // No auto-capitalization
};

defineExpose({ focus, capitalize });
</script>

<template>
  <VCombobox
    ref="inputRef"
    v-model="value"
    :label="label"
    :items="suggestions"
    variant="outlined"
    density="comfortable"
    class="text-h6"
    :rules="required ? [(v: string) => !!v || 'Required'] : []"
    hide-details
    spellcheck="true"
    autocomplete="off"
    :menu-props="{ closeOnContentClick: false }"
    clearable
    :return-object="false"
    @keydown="handleKeydown"
    @update:model-value="handleValueUpdate"
  />
</template>
