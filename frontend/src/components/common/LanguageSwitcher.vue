<template>
  <!-- Select Mode (e.g. for Settings Page form) -->
  <q-select
    v-if="mode === 'select'"
    :model-value="currentLocale"
    :options="languageOptions"
    :label="label || t('common.language')"
    dense
    outlined
    emit-value
    map-options
    options-dense
    @update:model-value="onSelectLanguage"
  >
    <template #selected-item="scope">
      <div class="row items-center no-wrap">
        <span class="q-mr-sm text-subtitle1">{{ scope.opt.flag }}</span>
        <span>{{ scope.opt.nativeName }}</span>
        <span class="text-caption text-grey-6 q-ml-xs">({{ scope.opt.label }})</span>
      </div>
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar style="min-width: 32px">
          <span class="text-h6">{{ scope.opt.flag }}</span>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.nativeName }}</q-item-label>
          <q-item-label caption>{{ scope.opt.label }}</q-item-label>
        </q-item-section>
        <q-item-section side v-if="scope.opt.value === currentLocale">
          <q-icon name="check" color="primary" size="18px" />
        </q-item-section>
      </q-item>
    </template>
  </q-select>

  <!-- Button Dropdown Mode (Default for Navbar & Auth pages) -->
  <q-btn
    v-else
    :flat="flat"
    :outline="outline"
    :dense="dense"
    :rounded="rounded"
    :color="color"
    :text-color="textColor"
    :class="btnClass"
    aria-label="Language selector"
    no-caps
  >
    <div class="row items-center no-wrap">
      <span class="q-mr-xs text-body1">{{ currentLanguage.flag }}</span>
      <span v-if="!iconOnly" class="text-weight-medium gt-xs q-mx-xs">{{ currentLanguage.nativeName }}</span>
      <q-icon name="arrow_drop_down" size="18px" class="q-ml-none" />
    </div>

    <q-menu auto-close anchor="bottom end" self="top end">
      <q-list style="min-width: 190px">
        <q-item-label header class="text-overline text-grey-7 q-py-xs">
          {{ t('common.selectLanguage') }}
        </q-item-label>
        <q-separator />
        <q-item
          v-for="lang in languages"
          :key="lang.code"
          clickable
          v-ripple
          :active="lang.code === currentLocale"
          active-class="bg-primary/10 text-primary text-weight-bold"
          @click="onSelectLanguage(lang.code)"
        >
          <q-item-section avatar style="min-width: 34px">
            <span class="text-subtitle1">{{ lang.flag }}</span>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ lang.nativeName }}</q-item-label>
            <q-item-label caption>{{ lang.name }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="lang.code === currentLocale">
            <q-icon name="check" color="primary" size="20px" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
    <q-tooltip>{{ t('common.selectLanguage') }}</q-tooltip>
  </q-btn>
</template>

<script setup>
import { computed } from 'vue'
import { useLanguage } from 'src/composables/useLanguage'

const props = defineProps({
  mode: { type: String, default: 'button' }, // 'button' | 'select'
  label: { type: String, default: '' },
  flat: { type: Boolean, default: true },
  outline: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  rounded: { type: Boolean, default: false },
  color: { type: String, default: '' },
  textColor: { type: String, default: '' },
  btnClass: { type: String, default: '' },
  iconOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])
const { currentLocale, currentLanguage, languages, setLanguage, t } = useLanguage()

const languageOptions = computed(() =>
  languages.map((l) => ({
    label: l.name,
    nativeName: l.nativeName,
    value: l.code,
    flag: l.flag,
    dir: l.dir,
  }))
)

function onSelectLanguage(code) {
  setLanguage(code)
  emit('change', code)
}
</script>
