<script setup lang="ts">
import { ref, computed } from 'vue';
import { VTextField } from 'vuetify/components';
import { focusInput, handleFieldNavigation } from '@/lib/fieldUtils';

const props = defineProps<{
  modelValue: string;
  label: string;
  onNext?: () => void;
  onPrevious?: () => void;
  required?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const inputRef = ref<InstanceType<typeof VTextField> | null>(null);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const capitalize = () => {
  if (value.value && /^[a-z]/.test(value.value)) {
    const capitalized = value.value.charAt(0).toUpperCase() + value.value.slice(1);
    value.value = capitalized;
  }
};

const focus = async () => {
  await focusInput(inputRef.value);
};

const handleKeydown = (event: KeyboardEvent) => handleFieldNavigation(event, props);

// Re-emit on blur so validation runs when the user clicks away
const handleBlur = () => {
  emit('update:modelValue', value.value);
};

defineExpose({ focus, capitalize });
</script>

<template>
  <VTextField ref="inputRef" v-model="value" :label="label" variant="outlined"
    :rules="required ? [(v: string) => !!v || 'Required'] : []" hide-details spellcheck="true" @keydown="handleKeydown"
    @blur="handleBlur" />
</template>
