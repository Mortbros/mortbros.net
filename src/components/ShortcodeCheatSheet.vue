<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import {
  VDialog, VCard, VCardTitle, VCardText, VTextField, VBtn, VChip, VDivider,
  VTable, VTabs, VTab, VTabsWindow, VTabsWindowItem,
} from 'vuetify/components'
import type { MappingInstance, ListValue } from '@/lib/db'

const props = defineProps<{
  modelValue: boolean
  mappings?: MappingInstance[]
  listValues?: ListValue[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const search = ref('')
const tab = ref('shortcuts')
const searchRef = ref<InstanceType<typeof VTextField> | null>(null)

// Focus the search box on open so you can filter straight away
watch(open, async (isOpen) => {
  if (!isOpen) return
  search.value = ''
  await nextTick()
  searchRef.value?.$el?.querySelector('input')?.focus()
})

// Mirrors the classification in patternMatcher: a name is a pattern if it has
// slots, a regex if it's /…/flags, otherwise a literal.
const kindOf = (name: string): 'pattern' | 'regex' | 'literal' => {
  if (name.includes('<')) return 'pattern'
  if (name.startsWith('/') && name.lastIndexOf('/') > 0) return 'regex'
  return 'literal'
}

const KIND_META = {
  literal: { label: 'Literal', color: 'success', order: 0 },
  pattern: { label: 'Pattern', color: 'primary', order: 1 },
  regex: { label: 'Regex', color: 'warning', order: 2 },
} as const

const matches = (haystack: string, q: string) => haystack.toLowerCase().includes(q)

const filteredMappings = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = (props.mappings ?? [])
    .filter(m => m.enabled)
    .filter(m => !q || matches(m.name, q) || matches(m.expansion, q))
    .map(m => ({ ...m, kind: kindOf(m.name) }))
  // Literals first, then patterns, then regex; alphabetical within each
  return rows.sort((a, b) =>
    KIND_META[a.kind].order - KIND_META[b.kind].order || a.name.localeCompare(b.name)
  )
})

/** Abbreviations grouped by type — the values that fill <type> slots. */
const filteredAbbreviations = computed(() => {
  const q = search.value.trim().toLowerCase()
  const byType = new Map<string, { abbreviation: string; value: string }[]>()
  for (const lv of props.listValues ?? []) {
    if (!lv.enabled || !lv.abbreviation) continue
    if (q && !matches(lv.abbreviation, q) && !matches(lv.value, q)) continue
    const list = byType.get(lv.type_id) ?? []
    list.push({ abbreviation: lv.abbreviation, value: lv.value })
    byType.set(lv.type_id, list)
  }
  return [...byType.entries()]
    .map(([typeId, values]) => ({
      typeId,
      values: values.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation)),
    }))
    .sort((a, b) => a.typeId.localeCompare(b.typeId))
})

const abbreviationCount = computed(() =>
  filteredAbbreviations.value.reduce((n, g) => n + g.values.length, 0)
)
</script>

<template>
  <VDialog v-model="open" max-width="820" scrollable>
    <VCard>
      <VCardTitle class="d-flex align-center ga-2 pe-2">
        <span>Shortcode reference</span>
        <VChip size="x-small" variant="tonal">Ctrl + /</VChip>
        <VBtn icon="mdi-close" variant="text" size="small" class="ms-auto" @click="open = false" />
      </VCardTitle>

      <div class="px-4 pb-2">
        <VTextField
          ref="searchRef"
          v-model="search"
          density="compact"
          placeholder="Search shortcuts, expansions or abbreviations…"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          autocomplete="off"
        />
      </div>

      <VTabs v-model="tab" density="compact">
        <VTab value="shortcuts">Shortcuts ({{ filteredMappings.length }})</VTab>
        <VTab value="abbreviations">Abbreviations ({{ abbreviationCount }})</VTab>
      </VTabs>
      <VDivider />

      <VCardText style="max-height: 60vh">
        <VTabsWindow v-model="tab" :transition="false" :reverse-transition="false">

          <VTabsWindowItem value="shortcuts">
            <div v-if="!filteredMappings.length" class="text-medium-emphasis text-center py-6">
              No shortcuts match “{{ search }}”.
            </div>
            <VTable v-else density="compact">
              <thead>
                <tr>
                  <th style="width: 30%">Type</th>
                  <th>Expands to</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in filteredMappings" :key="m.id">
                  <td>
                    <code class="shortcode">{{ m.name }}</code>
                    <VChip :color="KIND_META[m.kind].color" size="x-small" variant="tonal" class="ms-2">
                      {{ KIND_META[m.kind].label }}
                    </VChip>
                  </td>
                  <td class="text-medium-emphasis">{{ m.expansion }}</td>
                </tr>
              </tbody>
            </VTable>
          </VTabsWindowItem>

          <VTabsWindowItem value="abbreviations">
            <div v-if="!abbreviationCount" class="text-medium-emphasis text-center py-6">
              No abbreviations match “{{ search }}”.
            </div>
            <div v-for="group in filteredAbbreviations" :key="group.typeId" class="mb-4">
              <div class="text-subtitle-2 mb-1">
                <code class="shortcode">&lt;{{ group.typeId }}&gt;</code>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <VChip v-for="v in group.values" :key="v.abbreviation" size="small" variant="tonal">
                  <strong>{{ v.abbreviation }}</strong>
                  <span class="mx-1 text-disabled">→</span>
                  {{ v.value }}
                </VChip>
              </div>
            </div>
          </VTabsWindowItem>

        </VTabsWindow>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.shortcode {
  background: rgba(var(--v-theme-on-surface), 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

:deep(.v-window__container),
:deep(.v-window-item) {
  transition: none !important;
}
</style>
