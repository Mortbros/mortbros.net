<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { VTextField } from 'vuetify/components';

const props = defineProps<{
  modelValue: string;
  label: string;
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

const focus = () => {
  const input = inputRef.value?.$el.querySelector('input');
  if (input) {
    input.focus();
    input.select();
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    props.onPrevious?.();
  }
};

defineExpose({ focus });

onMounted(() => {
  if (!props.modelValue) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    emit('update:modelValue', `${year}-${month}-${day}`);
  }
});
</script>

<template>
  <VTextField
    ref="inputRef"
    v-model="value"
    :label="label"
    type="date"
    variant="outlined"
    density="comfortable"
    class="text-h6"
    :rules="required ? [(v: string) => !!v || 'Required'] : []"
    hide-details
    @keydown="handleKeydown"
  />
</template>
