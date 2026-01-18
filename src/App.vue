<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { VApp, VBtn, VCard, VCardActions, VCardText, VChip, VCol, VContainer, VDivider, VFadeTransition, VList, VListItem, VMain, VRow, VSlideYTransition, VSpacer, VTextarea, VTextField, VToolbar, VToolbarTitle } from 'vuetify/components';
import { mappings } from '@/assets/mappings'
import { nameMappings } from '@/assets/nameMappings'
import { matchPattern, expandValue } from '@/lib/patternMatcher'


// --- Constants ---
const STORAGE_KEY_RULES = 'text_expander_rules';
const STORAGE_KEY_CONTENT = 'text_expander_content';

// --- State ---
const content = ref<string>("");
const lastReplacement = ref<string | null>(null);
const copySuccess = ref(false);

// --- Methods ---
const copyToClipboard = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(content.value);
    copySuccess.value = true;
    setTimeout(() => copySuccess.value = false, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

const importRules = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target?.result as string);
      if (Array.isArray(imported)) {
        mappings.value = imported;
      }
    } catch (err) {
      console.error("Failed to parse imported rules:", err);
    }
  };
  reader.readAsText(file);
  target.value = '';
};

const handleInput = async (event: any): Promise<void> => {
  const textarea = event.target as HTMLTextAreaElement;
  if (!textarea) return;

  const val = textarea.value;
  const cursorPosition = textarea.selectionStart;

  content.value = val;

  const textBeforeCursor = val.slice(0, cursorPosition);

  if (textBeforeCursor.endsWith(' ')) {
    const tokens = textBeforeCursor.trimEnd().split(/\s+/);
    const lastWord = tokens[tokens.length - 1];
    if (!lastWord) return;

    let matchFound = false;
    let replacementText = "";
    let matchedKeyText = "";

    for (const rule of mappings.value) {
      const key = rule.key.trim();
      if (!key) continue;

      // Check for <p> or <p,> pattern (name slot)
      const hasNameSlot = key.includes('<p,>') || key.includes('<p>');
      
      if (hasNameSlot) {
        const matchResult = matchPattern(lastWord, key, nameMappings.value);
        if (matchResult.matched) {
          matchFound = true;
          replacementText = expandValue(rule.value, matchResult.matchedNames);
          matchedKeyText = lastWord;
          break;
        }
        continue; // Skip to next rule if name slot pattern didn't match
      }

      const isRegex = key.startsWith('/') && key.lastIndexOf('/') > 0;

      if (isRegex) {
        try {
          const pattern = key.slice(1, key.lastIndexOf('/'));
          const flags = key.slice(key.lastIndexOf('/') + 1);
          const regex = new RegExp(`^${pattern}$`, flags);

          if (regex.test(lastWord)) {
            matchFound = true;
            replacementText = rule.value;
            matchedKeyText = lastWord;
            break;
          }
        } catch (e) {
          console.error("Invalid Regex pattern:", key);
        }
      } else if (key === lastWord) {
        matchFound = true;
        replacementText = rule.value;
        matchedKeyText = key;
        break;
      }
    }

    if (matchFound) {
      const lengthToRemove = matchedKeyText.length + 1;
      const textBeforeTarget = textBeforeCursor.slice(0, -lengthToRemove);
      const textAfterCursor = val.slice(cursorPosition);

      const newValue = textBeforeTarget + replacementText + " " + textAfterCursor;
      content.value = newValue;

      lastReplacement.value = matchedKeyText;
      setTimeout(() => lastReplacement.value = null, 2000);

      const newCursorPos = textBeforeTarget.length + replacementText.length + 1;

      await nextTick();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
  }
};
</script>

<template>
  <VContainer fluid class="fill-height align-start">
    <VRow>
      <VCol cols="12" md="8">
        <VCard variant="outlined" class="rounded-lg fill-height d-flex flex-column">
          <VToolbar color="grey-lighten-4" flat>
            <VToolbarTitle class="text-subtitle-1 font-weight-bold">
              Text Editor
            </VToolbarTitle>
            <VSpacer></VSpacer>
            <VBtn variant="text" :color="copySuccess ? 'success' : 'primary'"
              :prepend-icon="copySuccess ? 'mdi-check' : 'mdi-content-copy'" size="small" class="mr-2"
              @click="copyToClipboard">
              {{ copySuccess ? 'Copied!' : 'Copy Text' }}
            </VBtn>
            <VDivider vertical inset class="mx-2"></VDivider>
            <span class="text-caption text-grey px-2">Autosave Enabled</span>
          </VToolbar>

          <VCardText class="pa-0 flex-grow-1 position-relative">
            <VTextarea v-model="content" @input="handleInput" placeholder="Try typing 'omg ' or a regex match..."
              variant="plain" class="pa-4 text-h6 editor-textarea" auto-grow hide-details rows="15"
              persistent-placeholder></VTextarea>

            <VFadeTransition>
              <VChip v-if="lastReplacement" color="success" class="position-absolute ma-4"
                style="bottom: 0; right: 0; z-index: 10">
                Expanded: {{ lastReplacement }}
              </VChip>
            </VFadeTransition>
          </VCardText>

          <VDivider></VDivider>
          <VCardActions>
            <VSpacer></VSpacer>
            <VBtn color="error" variant="text" size="small" @click="content = ''">
              Clear Text
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>

      <VCol cols="12" md="4">
        <VCard variant="outlined" class="rounded-lg mb-4">
          <VToolbar color="grey-lighten-4" flat>
            <VToolbarTitle class="text-subtitle-1 font-weight-bold">
              Replacements
            </VToolbarTitle>

            <input type="file" ref="fileInput" style="display: none" accept=".json" @change="importRules" />
          </VToolbar>

          <VList class="pa-4" style="max-height: 500px; overflow-y: auto;">
            <VSlideYTransition group>
              <VListItem v-for="(item, index) in mappings" :key="index" class="pa-0 mb-4">
                <VCard variant="flat" border class="pa-2 w-100 bg-grey-lighten-5">
                  <div class="d-flex align-center">
                    <div class="flex-grow-1">
                      <VTextField v-model="item.key" label="Key (or /regex/)" density="compact" variant="underlined"
                        hide-details class="mb-1 font-weight-bold font-mono" placeholder="e.g. /h.llo/ or d<p,>t"></VTextField>
                      <VTextField v-model="item.value" label="Replacement Value" density="compact" variant="underlined"
                        hide-details placeholder="Text to insert (use <p> for names)"></VTextField>
                    </div>
                  </div>
                </VCard>
              </VListItem>
            </VSlideYTransition>
          </VList>

          <VDivider></VDivider>
          <VCardActions class="pa-4">
          </VCardActions>
        </VCard>

        <VCard variant="outlined" class="rounded-lg">
          <VToolbar color="grey-lighten-4" flat>
            <VToolbarTitle class="text-subtitle-1 font-weight-bold">
              Name Mappings
            </VToolbarTitle>
          </VToolbar>

          <VList class="pa-4" style="max-height: 500px; overflow-y: auto;">
            <VSlideYTransition group>
              <VListItem v-for="(item, index) in nameMappings" :key="index" class="pa-0 mb-4">
                <VCard variant="flat" border class="pa-2 w-100 bg-grey-lighten-5">
                  <div class="d-flex align-center">
                    <div class="flex-grow-1">
                      <VTextField v-model="item.key" label="Key" density="compact" variant="underlined"
                        hide-details class="mb-1 font-weight-bold font-mono" placeholder="e.g. i"></VTextField>
                      <VTextField v-model="item.value" label="Name" density="compact" variant="underlined"
                        hide-details placeholder="e.g. izzy"></VTextField>
                    </div>
                  </div>
                </VCard>
              </VListItem>
            </VSlideYTransition>
          </VList>

          <VDivider></VDivider>
          <VCardActions class="pa-4">
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<style scoped>
.editor-textarea :deep(textarea) {
  line-height: 1.6;
}

.hover-danger:hover {
  color: rgb(var(--v-theme-error)) !important;
}
</style>