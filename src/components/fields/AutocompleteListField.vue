<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { VCombobox } from 'vuetify/components';

const props = defineProps<{
  modelValue: string[];
  label: string;
  suggestions: string[];
  onNext?: () => void;
  onPrevious?: () => void;
  required?: boolean;
  autoSelect?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const inputRefs = ref<(InstanceType<typeof VCombobox> | null)[]>([]);
const localItems = ref<string[]>(['']);
const isInternalUpdate = ref(false);

const focus = async () => {
  await nextTick();
  if (inputRefs.value.length > 0 && inputRefs.value[0]) {
    const input = inputRefs.value[0].$el.querySelector('input') as HTMLInputElement;
    if (input) {
      input.focus();
      await nextTick();
      if (props.autoSelect !== false) {
        input.select();
      }
    }
  }
};

defineExpose({ focus });

// Sync localItems with modelValue (only when changed externally)
watch(() => props.modelValue, (newVal) => {
  if (!isInternalUpdate.value) {
    if (!newVal || newVal.length === 0) {
      localItems.value = [''];
    } else {
      localItems.value = [...newVal, ''];
    }
  }
  isInternalUpdate.value = false;
}, { immediate: true });

const handleKeydown = async (event: KeyboardEvent, index: number) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    // Ctrl+Enter: Add new field
    event.preventDefault();
    const currentValue = localItems.value[index]?.trim() || '';
    const itemsToSave = localItems.value.slice(0, -1).filter(item => item.trim() !== '');
    if (currentValue) {
      itemsToSave.push(currentValue);
    }
    isInternalUpdate.value = true;
    emit('update:modelValue', itemsToSave);
    
    // Add new empty field
    localItems.value = [...itemsToSave, ''];
    await nextTick();
    // Focus the new field
    const newIndex = itemsToSave.length;
    if (inputRefs.value[newIndex]) {
      const input = inputRefs.value[newIndex].$el.querySelector('input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
  } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
    // Enter: Move to next field
    event.preventDefault();
    
    if (index < localItems.value.length - 1) {
      // Move to next field in list
      await nextTick();
      if (inputRefs.value[index + 1]) {
        inputRefs.value[index + 1].$el.querySelector('input')?.focus();
      }
    } else {
      // Last field, move to next section
      const itemsToSave = localItems.value.slice(0, -1).filter(item => item.trim() !== '');
      isInternalUpdate.value = true;
      emit('update:modelValue', itemsToSave);
      props.onNext?.();
    }
  } else if (event.key === 'Enter' && event.shiftKey && index === 0) {
    event.preventDefault();
    props.onPrevious?.();
  }
};

const updateItem = (index: number, value: string) => {
  if (index >= localItems.value.length) {
    localItems.value = [...localItems.value, ...Array(index - localItems.value.length + 1).fill('')];
  }
  localItems.value[index] = value || '';
  // Update model value (excluding the last empty field if it exists)
  const itemsToSave = localItems.value.filter((item, idx) => {
    if (idx === localItems.value.length - 1 && item.trim() === '') {
      return false; // Don't save the trailing empty field
    }
    return item.trim() !== '';
  });
  isInternalUpdate.value = true;
  emit('update:modelValue', itemsToSave);
};
</script>

<template>
  <div class="list-field">
    <div
      v-for="(item, index) in localItems"
      :key="index"
      class="mb-2"
    >
      <VCombobox
        :ref="(el) => { if (el) inputRefs[index] = el as InstanceType<typeof VCombobox> }"
        :model-value="localItems[index]"
        :label="index === 0 ? label : ''"
        :items="suggestions"
        variant="outlined"
        density="comfortable"
        class="text-h6"
        hide-details
        spellcheck="true"
        autocomplete="off"
        clearable
        @update:model-value="updateItem(index, $event)"
        @keydown="handleKeydown($event, index)"
      />
    </div>
  </div>
</template>
