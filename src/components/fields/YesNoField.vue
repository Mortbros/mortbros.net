<script setup lang="ts">
import { ref, computed, watch } from 'vue';
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
  get: () => props.modelValue || 'N',
  set: (val) => emit('update:modelValue', val)
});

const focus = async () => {
  await focusInput(inputRef.value);
};

defineExpose({ focus });

const handleKeydown = (event: KeyboardEvent) => {
  // Y/N set the value and advance in one keystroke
  const key = event.key.toLowerCase();
  if (key === 'y' || key === 'n') {
    event.preventDefault();
    value.value = key.toUpperCase();
    props.onNext?.();
    return;
  }
  handleFieldNavigation(event, props);
};

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    value.value = 'N';
  }
}, { immediate: true });
</script>

<template>
  <VTextField ref="inputRef" v-model="value" :label="label" variant="outlined"
    :rules="required ? [(v: string) => !!v || 'Required'] : []" hide-details @keydown="handleKeydown" />
</template>
