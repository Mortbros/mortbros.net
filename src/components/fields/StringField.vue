<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { VTextField } from 'vuetify/components';

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

const handleBlur = () => {
  // Capitalization removed - user can capitalize manually or use button
};

const focus = async () => {
  await nextTick();
  const input = inputRef.value?.$el.querySelector('input') as HTMLInputElement;
  if (input) {
    input.focus();
    await nextTick();
    input.select();
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    props.onNext?.();
  } else if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    props.onPrevious?.();
  }
};

defineExpose({ focus, capitalize });
</script>

<template>
  <VTextField
    ref="inputRef"
    v-model="value"
    :label="label"
    variant="outlined"
    density="comfortable"
    class="text-h6"
    :rules="required ? [(v: string) => !!v || 'Required'] : []"
    hide-details
    spellcheck="true"
    @keydown="handleKeydown"
  />
</template>
