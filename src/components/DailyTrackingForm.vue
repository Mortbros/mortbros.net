<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue';
import { useTheme } from 'vuetify';
import { VContainer, VRow, VCol, VCard, VCardText, VBtn, VDivider, VChip, VSwitch, VIcon } from 'vuetify/components';
import DateField from './fields/DateField.vue';
import YesNoField from './fields/YesNoField.vue';
import TimeField from './fields/TimeField.vue';
import FloatField from './fields/FloatField.vue';
import IntField from './fields/IntField.vue';
import StringField from './fields/StringField.vue';
import ListField from './fields/ListField.vue';
import PatternTextField from './fields/PatternTextField.vue';
import TimeDisplay from './fields/TimeDisplay.vue';
import AutocompleteField from './fields/AutocompleteField.vue';
import AutocompleteListField from './fields/AutocompleteListField.vue';
import { exerciseSuggestions } from '@/assets/exerciseSuggestions';
import { musicSuggestions } from '@/assets/musicSuggestions';
import { phaseSuggestions } from '@/assets/phaseSuggestions';
import { gameSuggestions } from '@/assets/gameSuggestions';

const STORAGE_KEY = 'daily_tracking_form_data';
const THEME_KEY = 'daily_tracking_theme';

// Dark mode
const theme = useTheme();
// Initialize from localStorage or default to dark
const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};
const isDark = ref(getInitialTheme() === 'dark');

// Set initial theme
theme.global.name.value = isDark.value ? 'dark' : 'light';

const toggleTheme = (val: boolean) => {
  isDark.value = val;
  theme.global.name.value = isDark.value ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
  } catch (err) {
    console.error('Failed to save theme:', err);
  }
};

// Form data
const formData = ref({
  date: '',
  bathe: 'N',
  wake: '',
  sleep: '',
  stress: 0,
  tired: 0,
  game: 'N',
  music: 'N',
  grateful: [] as string[],
  learn: [] as string[],
  exercise: [] as string[],
  remember: 0,
  dayRating: 0,
  feeling: 0,
  why: '',
  phase: [] as string[],
  happened: '',
  time: '',
  dayName: ''
});

// Load from localStorage
const loadFormData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(formData.value, parsed);
    }
  } catch (err) {
    console.error('Failed to load form data:', err);
  }
};

// Save to localStorage
const saveFormData = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData.value));
  } catch (err) {
    console.error('Failed to save form data:', err);
  }
};

// Watch form data and save on changes
watch(formData, () => {
  saveFormData();
}, { deep: true });

// Set date to today
const setDateToToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  formData.value.date = `${year}-${month}-${day}`;
};

// Clear form
const clearForm = () => {
  formData.value = {
    date: '',
    bathe: 'N',
    wake: '',
    sleep: '',
    stress: 0,
    tired: 0,
    game: 'N',
    music: 'N',
    grateful: [],
    learn: [],
    exercise: 'N',
    remember: 0,
    dayRating: 0,
    feeling: 0,
    why: '',
    phase: [],
    happened: '',
    time: '',
    dayName: ''
  };
  setDateToToday();
  localStorage.removeItem(STORAGE_KEY);
  // Focus on bathe after clearing
  nextTick(() => {
    batheFieldRef.value?.focus();
  });
};

// Field refs for focus management
const dateFieldRef = ref<InstanceType<typeof DateField> | null>(null);
const batheFieldRef = ref<InstanceType<typeof YesNoField> | null>(null);
const wakeFieldRef = ref<InstanceType<typeof TimeField> | null>(null);
const sleepFieldRef = ref<InstanceType<typeof TimeField> | null>(null);
const stressFieldRef = ref<InstanceType<typeof FloatField> | null>(null);
const tiredFieldRef = ref<InstanceType<typeof FloatField> | null>(null);
const gameFieldRef = ref<InstanceType<typeof AutocompleteField> | null>(null);
const musicFieldRef = ref<InstanceType<typeof AutocompleteField> | null>(null);
const exerciseFieldRef = ref<InstanceType<typeof AutocompleteField> | null>(null);
const gratefulFieldRef = ref<InstanceType<typeof ListField> | null>(null);
const learnFieldRef = ref<InstanceType<typeof ListField> | null>(null);
const rememberFieldRef = ref<InstanceType<typeof FloatField> | null>(null);
const dayRatingFieldRef = ref<InstanceType<typeof FloatField> | null>(null);
const feelingFieldRef = ref<InstanceType<typeof IntField> | null>(null);
const whyFieldRef = ref<InstanceType<typeof StringField> | null>(null);
const phaseFieldRef = ref<InstanceType<typeof AutocompleteListField> | null>(null);
const happenedFieldRef = ref<InstanceType<typeof PatternTextField> | null>(null);
const timeDisplayRef = ref<InstanceType<typeof TimeDisplay> | null>(null);
const dayNameFieldRef = ref<InstanceType<typeof StringField> | null>(null);

// Field labels for validation
const fieldLabels: Record<string, string> = {
  date: 'Date',
  bathe: 'Bathe',
  wake: 'Wake',
  sleep: 'Sleep',
  stress: 'Stress',
  tired: 'Tired',
  game: 'Game',
  music: 'Music',
  grateful: 'Grateful',
  learn: 'Learn',
  exercise: 'Exercise',
  remember: 'Remember',
  dayRating: 'Day rating',
  feeling: 'Feeling',
  why: 'Why',
  phase: 'Phase',
  happened: 'Happened'
};

// Map error labels to field refs
const errorToFieldRef: Record<string, () => void> = {
  'Date': () => dateFieldRef.value?.focus(),
  'Bathe': () => batheFieldRef.value?.focus(),
  'Wake': () => wakeFieldRef.value?.focus(),
  'Sleep': () => sleepFieldRef.value?.focus(),
  'Stress': () => stressFieldRef.value?.focus(),
  'Tired': () => tiredFieldRef.value?.focus(),
  'Music': () => musicFieldRef.value?.focus(),
  'Grateful': () => gratefulFieldRef.value?.focus(),
  'Learn': () => learnFieldRef.value?.focus(),
  'Exercise': () => exerciseFieldRef.value?.focus(),
  'Remember': () => rememberFieldRef.value?.focus(),
  'Day rating': () => dayRatingFieldRef.value?.focus(),
  'Feeling': () => feelingFieldRef.value?.focus(),
  'Why': () => whyFieldRef.value?.focus(),
  'Phase': () => phaseFieldRef.value?.focus(),
  'Happened': () => happenedFieldRef.value?.focus()
};

const focusFieldByError = (errorLabel: string) => {
  const focusFn = errorToFieldRef[errorLabel];
  if (focusFn) {
    focusFn();
  }
};

// Validation errors
const validationErrors = ref<string[]>([]);

const validateForm = () => {
  const errors: string[] = [];

  if (!formData.value.date) errors.push('Date');
  if (!formData.value.bathe) errors.push('Bathe');
  if (!formData.value.wake) errors.push('Wake');
  if (!formData.value.sleep) errors.push('Sleep');
  if (formData.value.stress < 1) errors.push('Stress');
  if (formData.value.tired < 1) errors.push('Tired');
  // Game is not required
  if (!formData.value.music) errors.push('Music');
  if (!formData.value.grateful || !Array.isArray(formData.value.grateful) || formData.value.grateful.length === 0) errors.push('Grateful');
  if (!formData.value.learn || !Array.isArray(formData.value.learn) || formData.value.learn.length === 0) errors.push('Learn');
  if (!formData.value.exercise) errors.push('Exercise');
  if (formData.value.remember < 1) errors.push('Remember');
  if (formData.value.dayRating < 1) errors.push('Day rating');
  if (formData.value.feeling < 1) errors.push('Feeling');
  if (!formData.value.why) errors.push('Why');
  if (!formData.value.phase || !Array.isArray(formData.value.phase) || formData.value.phase.length === 0) errors.push('Phase');
  if (!formData.value.happened) errors.push('Happened');

  validationErrors.value = errors;
};

// Watch form data for validation
watch(formData, () => {
  validateForm();
}, { deep: true, immediate: true });

// Focus order array
const focusOrder = [
  () => batheFieldRef.value?.focus(),
  () => wakeFieldRef.value?.focus(),
  () => sleepFieldRef.value?.focus(),
  () => stressFieldRef.value?.focus(),
  () => tiredFieldRef.value?.focus(),
  () => gameFieldRef.value?.focus(),
  () => musicFieldRef.value?.focus(),
  () => gratefulFieldRef.value?.focus(),
  () => learnFieldRef.value?.focus(),
  () => exerciseFieldRef.value?.focus(),
  () => rememberFieldRef.value?.focus(),
  () => dayRatingFieldRef.value?.focus(),
  () => feelingFieldRef.value?.focus(),
  () => whyFieldRef.value?.focus(),
  () => phaseFieldRef.value?.focus(),
  () => happenedFieldRef.value?.focus(),
  () => dayNameFieldRef.value?.focus()
];

// Navigation functions
const moveToNextField = async (currentIndex: number) => {
  const nextIndex = currentIndex + 1;
  if (nextIndex < focusOrder.length) {
    await nextTick();
    const focusFn = focusOrder[nextIndex];
    if (focusFn) {
      focusFn();
      // Scroll to center the focused element
      await nextTick();
      const activeElement = document.activeElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
};

const moveToPreviousField = async (currentIndex: number) => {
  const prevIndex = currentIndex - 1;
  if (prevIndex >= 0) {
    await nextTick();
    const focusFn = focusOrder[prevIndex];
    if (focusFn) {
      focusFn();
      // Scroll to center the focused element
      await nextTick();
      const activeElement = document.activeElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
};

// Copy to clipboard
const copySuccess = ref(false);
const copyToClipboard = async () => {
  const values = [
    formData.value.date,
    formData.value.bathe,
    formData.value.wake,
    formData.value.sleep,
    String(formData.value.stress),
    String(formData.value.tired),
    formData.value.game,
    formData.value.music,
    formData.value.grateful.join(','),
    formData.value.learn.join(','),
    formData.value.exercise,
    String(formData.value.remember),
    String(formData.value.dayRating),
    String(formData.value.feeling),
    formData.value.why,
    formData.value.phase.join(','),
    formData.value.time,
    formData.value.happened,
    formData.value.dayName
  ];

  const tabSeparated = values.join('\t');

  try {
    await navigator.clipboard.writeText(tabSeparated);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

// Button focus state
const clearButtonRef = ref<InstanceType<typeof VBtn> | null>(null);
const isClearButtonFocused = ref(false);

const focusClearButton = () => {
  clearButtonRef.value?.$el.focus();
  isClearButtonFocused.value = true;
};

const handleClearButtonKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    clearForm();
  }
};

// Focus on bathe field on mount
onMounted(async () => {
  loadFormData();
  await nextTick();
  batheFieldRef.value?.focus();
});
</script>

<template>
  <VContainer fluid class="fill-height">
    <VRow justify="center">
      <VCol cols="12" md="10" lg="8" xl="6">
        <VCard variant="outlined" class="pa-6">
          <div class="d-flex justify-end align-center mb-4" style="min-height: 40px;">
            <VSwitch :model-value="isDark" :label="isDark ? 'Dark Mode' : 'Light Mode'" color="primary"
              @update:model-value="(val: boolean) => toggleTheme(val)" />
          </div>
          <VCardText>
            <div class="d-flex flex-column ga-6">
              <!-- Date -->
              <div class="d-flex align-center ga-2">
                <div class="flex-grow-1">
                  <DateField ref="dateFieldRef" v-model="formData.date" label="Date" :required="true"
                    :on-previous="() => moveToPreviousField(0)" />
                </div>
                <VBtn size="small" variant="outlined" @click="setDateToToday">
                  Today
                </VBtn>
              </div>

              <!-- Bathe -->
              <YesNoField ref="batheFieldRef" v-model="formData.bathe" label="Bathe" :required="true"
                :on-next="() => moveToNextField(0)" :on-previous="() => moveToPreviousField(1)" />

              <!-- Wake -->
              <TimeField ref="wakeFieldRef" v-model="formData.wake" label="Wake" :required="true"
                :on-next="() => moveToNextField(1)" :on-previous="() => moveToPreviousField(2)" />

              <!-- Sleep -->
              <TimeField ref="sleepFieldRef" v-model="formData.sleep" label="Sleep" :default-to-future="true"
                :future-minutes="20" :required="true" :on-next="() => moveToNextField(2)"
                :on-previous="() => moveToPreviousField(3)" />

              <!-- Stress -->
              <FloatField ref="stressFieldRef" v-model="formData.stress" label="Stress" :max="10" :required="true"
                :on-next="() => moveToNextField(3)" :on-previous="() => moveToPreviousField(4)" />

              <!-- Tired -->
              <FloatField ref="tiredFieldRef" v-model="formData.tired" label="Tired" :max="10" :required="true"
                :on-next="() => moveToNextField(4)" :on-previous="() => moveToPreviousField(5)" />

              <!-- Game -->
              <AutocompleteField ref="gameFieldRef" v-model="formData.game" label="Game" :suggestions="gameSuggestions"
                :required="false" :on-next="() => moveToNextField(5)" :on-previous="() => moveToPreviousField(6)" />

              <!-- Music -->
              <AutocompleteField ref="musicFieldRef" v-model="formData.music" label="Music"
                :suggestions="musicSuggestions" :required="true" :on-next="() => moveToNextField(6)"
                :on-previous="() => moveToPreviousField(7)" />

              <!-- Grateful -->
              <ListField ref="gratefulFieldRef" v-model="formData.grateful" label="Grateful" :required="true"
                :on-next="() => moveToNextField(7)" :on-previous="() => moveToPreviousField(8)" />

              <!-- Learn -->
              <ListField ref="learnFieldRef" v-model="formData.learn" label="Learn" :required="true"
                :on-next="() => moveToNextField(8)" :on-previous="() => moveToPreviousField(9)" />

              <!-- Exercise -->
              <AutocompleteField ref="exerciseFieldRef" v-model="formData.exercise" label="Exercise"
                :suggestions="exerciseSuggestions" :required="true" :on-next="() => moveToNextField(9)"
                :on-previous="() => moveToPreviousField(10)" />

              <!-- Remember -->
              <FloatField ref="rememberFieldRef" v-model="formData.remember" label="Remember" :max="10" :required="true"
                :on-next="() => moveToNextField(10)" :on-previous="() => moveToPreviousField(10)" />

              <!-- Day rating -->
              <FloatField ref="dayRatingFieldRef" v-model="formData.dayRating" label="Day rating" :max="10"
                :required="true" :on-next="() => moveToNextField(11)" :on-previous="() => moveToPreviousField(11)" />

              <!-- Feeling -->
              <IntField ref="feelingFieldRef" v-model="formData.feeling" label="Feeling" :max="100" :required="true"
                :on-next="() => moveToNextField(12)" :on-previous="() => moveToPreviousField(12)" />

              <!-- Why -->
              <StringField ref="whyFieldRef" v-model="formData.why" label="Why" :required="true"
                :on-next="() => moveToNextField(13)" :on-previous="() => moveToPreviousField(13)" />

              <!-- Phase -->
              <AutocompleteListField ref="phaseFieldRef" v-model="formData.phase" label="Phase"
                :suggestions="phaseSuggestions" :required="true" :auto-select="false"
                :on-next="() => moveToNextField(14)" :on-previous="() => moveToPreviousField(15)" />

              <!-- Happened -->
              <div class="d-flex align-center ga-2">
                <div class="flex-grow-1">
                  <PatternTextField ref="happenedFieldRef" v-model="formData.happened" label="Happened" :required="true"
                    :on-next="() => moveToNextField(15)" :on-previous="() => moveToPreviousField(15)" />
                </div>
                <VBtn size="small" variant="outlined" @click="happenedFieldRef?.capitalize()">
                  Capitalize
                </VBtn>
              </div>

              <!-- Time -->
              <TimeDisplay ref="timeDisplayRef" v-model="formData.time" />

              <!-- Day name -->
              <StringField ref="dayNameFieldRef" v-model="formData.dayName" label="Day name" :required="false"
                :on-next="focusClearButton" :on-previous="() => moveToPreviousField(17)" />

              <VDivider class="my-4" />

              <!-- Validation Errors -->
              <div v-if="validationErrors.length > 0" class="mb-4">
                <div class="text-body-1 font-weight-bold mb-2 text-error">
                  Missing or invalid fields:
                </div>
                <div class="d-flex flex-wrap ga-2">
                  <VChip 
                    v-for="error in validationErrors" 
                    :key="error" 
                    color="error" 
                    variant="outlined" 
                    size="small"
                    style="cursor: pointer;"
                    @click="focusFieldByError(error)"
                  >
                    {{ error }}
                  </VChip>
                </div>
              </div>

              <!-- Buttons -->
              <div class="d-flex justify-center flex-wrap ga-4">
                <VBtn :color="copySuccess ? 'success' : 'primary'" size="large" class="text-h6"
                  @click="copyToClipboard">
                  <VIcon :icon="copySuccess ? 'mdi-check' : 'mdi-content-copy'" class="mr-2"></VIcon>
                  {{ copySuccess ? 'Copied!' : 'Copy to Clipboard' }}
                </VBtn>
                <VBtn ref="clearButtonRef" color="error" size="large" class="text-h6" @click="clearForm"
                  @keydown="handleClearButtonKeydown">
                  <VIcon icon="mdi-delete" class="mr-2"></VIcon>
                  Clear
                </VBtn>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<style scoped>
:deep(.v-field) {
  transition: all 0.2s ease;
  font-size: 1.5rem !important;
}

:deep(.v-field--focused) {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.3) !important;
  transform: scale(1.01);
}

:deep(.v-field--error) {
  border-color: rgb(var(--v-theme-error)) !important;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-error), 0.5) !important;
  background-color: rgba(var(--v-theme-error), 0.1) !important;
}

:deep(.v-field--error .v-field__input) {
  color: rgb(var(--v-theme-error)) !important;
}

:deep(.v-input) {
  font-size: 1.5rem !important;
}

:deep(.v-label) {
  font-size: 1.3rem !important;
  font-weight: 600 !important;
}

:deep(input),
:deep(textarea) {
  font-size: 1.5rem !important;
  padding: 16px !important;
}

:deep(.v-field__input) {
  min-height: 64px !important;
  position: relative;
  z-index: 1;
}

:deep(.v-field__outline) {
  z-index: 0;
}

:deep(.v-textarea .v-field__input) {
  min-height: 120px !important;
}

.v-card {
  max-width: 100%;
}

.ga-6 {
  gap: 2rem !important;
}
</style>
