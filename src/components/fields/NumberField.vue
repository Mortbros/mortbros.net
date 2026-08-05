<script setup lang="ts">
import { ref, computed } from 'vue';
import { VTextField } from 'vuetify/components';
import { focusInput, handleFieldNavigation } from '@/lib/fieldUtils';

/**
 * Backs both the `float` and `int` schema field types — they differed only in
 * parseFloat vs parseInt and the step attribute. Pass `integer` for `int`.
 */
const props = defineProps<{
  modelValue: number | string;
  label: string;
  max?: number;
  integer?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  required?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const inputRef = ref<InstanceType<typeof VTextField> | null>(null);

const parse = (val: string): number =>
  props.integer ? parseInt(val, 10) : parseFloat(val);

/** Clamp to [0, max]; empty input resets to 0. Emits nothing for junk input. */
const commit = (val: string) => {
  const num = parse(val);
  if (!isNaN(num)) {
    emit('update:modelValue', props.max !== undefined ? Math.min(Math.max(0, num), props.max) : num);
  } else if (val === '') {
    emit('update:modelValue', 0);
  }
};

const stringValue = computed({
  get: () => {
    const v = props.modelValue;
    return v === null || v === undefined || v === '' ? '' : String(v);
  },
  set: commit,
});

const focus = async () => {
  await focusInput(inputRef.value);
};

const handleKeydown = (event: KeyboardEvent) => handleFieldNavigation(event, props);

// Re-commit on blur so validation runs when the user clicks away
const handleBlur = () => commit(stringValue.value);

defineExpose({ focus });
</script>

<template>
  <VTextField
    ref="inputRef"
    v-model="stringValue"
    :label="label"
    type="number"
    :step="integer ? 1 : 0.1"
    :min="1"
    :max="max"
    variant="outlined"
    :rules="required ? [(v: string) => (v !== '' && parse(v) >= 1) || 'Must be at least 1'] : []"
    hide-details
    @keydown="handleKeydown"
    @blur="handleBlur"
  />
</template>
