<template>
  <div class="page-container q-pa-md q-pa-lg-md ta-page">
    <AppPageHeader
      :title="t('theme.title')"
      :subtitle="t('theme.subtitle')"
      icon="palette"
      :meta="headerMeta"
    >
      <template #actions>
        <q-btn
          outline
          dense
          no-caps
          color="grey-8"
          icon="restart_alt"
          :label="t('theme.resetToDefault')"
          :disable="saving"
          data-cy="theme-reset"
          @click="onResetToDefault"
        >
          <q-tooltip>{{ t('theme.resetConfirmMessage') }}</q-tooltip>
        </q-btn>
      </template>
    </AppPageHeader>

    <div v-if="loading && !loaded" class="q-mt-sm">
      <q-skeleton type="rect" height="180px" class="q-mb-sm" />
      <q-skeleton type="rect" height="120px" />
    </div>

    <template v-else>
      <!-- ------------------------------------------------------------------
           Live theme preview — updates on every keystroke / colour drag
           ------------------------------------------------------------------ -->
      <q-card flat bordered class="ta-card q-mb-md">
        <q-card-section class="ta-card__head">
          <q-icon name="visibility" size="18px" class="ta-card__icon q-mr-sm" />
          <div class="col min-width-0">
            <div class="ta-card__title">{{ t('theme.preview') }}</div>
            <div class="ta-card__hint">{{ t('theme.previewHint') }}</div>
          </div>
          <q-chip dense size="sm" :color="dirty ? 'warning' : 'positive'" text-color="white" :icon="dirty ? 'pending' : 'check'">
            {{ dirty ? t('theme.unsaved') : t('theme.saved').replace(/\.$/, '') }}
          </q-chip>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <ThemePreview :brand-name="brandLabel" :initials="authStore.initials" />
        </q-card-section>
      </q-card>

      <div class="row q-col-gutter-md">
        <!-- ----------------------------------------------------------------
             Colour scheme
             ---------------------------------------------------------------- -->
        <div class="col-12 col-lg-7">
          <q-card flat bordered class="ta-card full-height">
            <q-card-section class="ta-card__head">
              <q-icon name="style" size="18px" class="ta-card__icon q-mr-sm" />
              <div class="col min-width-0">
                <div class="ta-card__title">{{ t('theme.colourScheme') }}</div>
                <div class="ta-card__hint">{{ t('theme.colourSchemeHint') }}</div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div class="row q-col-gutter-sm">
                <div
                  v-for="scheme in schemes"
                  :key="scheme.id"
                  class="col-6 col-sm-4 col-md-3"
                >
                  <ThemeCard
                    :scheme="scheme"
                    :selected="scheme.id === theme.settings.schemeId"
                    :recommended-label="t('theme.recommended')"
                    @select="selectScheme"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- ----------------------------------------------------------------
             Fine-tune
             ---------------------------------------------------------------- -->
        <div class="col-12 col-lg-5">
          <q-card flat bordered class="ta-card full-height">
            <q-card-section class="ta-card__head">
              <q-icon name="tune" size="18px" class="ta-card__icon q-mr-sm" />
              <div class="col min-width-0">
                <div class="ta-card__title">{{ t('theme.fineTune') }}</div>
                <div class="ta-card__hint">{{ t('theme.previewHint') }}</div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div class="row q-col-gutter-sm">
                <!-- Display mode -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="contrast" :title="t('theme.displayMode')" :hint="t('theme.displayModeHint')">
                    <SegmentedControl
                      :model-value="theme.settings.mode"
                      :options="modeOptions"
                      :aria-label="t('theme.displayMode')"
                      @update:model-value="theme.setDisplayMode"
                    />
                  </FineTuneCard>
                </div>

                <!-- Font size -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="text_fields" :title="t('theme.fontSize')" :hint="t('theme.fontSizeHint')">
                    <SegmentedControl
                      :model-value="theme.settings.fontSize"
                      :options="fontSizeOptions"
                      :aria-label="t('theme.fontSize')"
                      @update:model-value="theme.setFontSize"
                    />
                  </FineTuneCard>
                </div>

                <!-- Corner radius -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="rounded_corner" :title="t('theme.cornerRadius')" :hint="t('theme.cornerRadiusHint')">
                    <SegmentedControl
                      :model-value="theme.settings.radius"
                      :options="radiusOptions"
                      :aria-label="t('theme.cornerRadius')"
                      @update:model-value="theme.setBorderRadius"
                    />
                  </FineTuneCard>
                </div>

                <!-- Sidebar style -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="view_sidebar" :title="t('theme.sidebarStyle')" :hint="t('theme.sidebarStyleHint')">
                    <SegmentedControl
                      :model-value="theme.settings.sidebar"
                      :options="sidebarOptions"
                      :aria-label="t('theme.sidebarStyle')"
                      @update:model-value="theme.setSidebarStyle"
                    />
                  </FineTuneCard>
                </div>

                <!-- Table density -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="table_rows" :title="t('theme.tableDensity')" :hint="t('theme.tableDensityHint')">
                    <SegmentedControl
                      :model-value="theme.settings.tableDensity"
                      :options="densityOptions"
                      :aria-label="t('theme.tableDensity')"
                      @update:model-value="theme.setTableDensity"
                    />
                  </FineTuneCard>
                </div>

                <!-- Calendar -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="calendar_month" :title="t('theme.calendar')" :hint="t('theme.calendarHint')">
                    <SegmentedControl
                      :model-value="theme.settings.calendar"
                      :options="calendarOptions"
                      :aria-label="t('theme.calendar')"
                      @update:model-value="theme.setCalendarType"
                    />
                  </FineTuneCard>
                </div>

                <!-- Animations -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="animation" :title="t('theme.animations')" :hint="t('theme.animationsHint')">
                    <SegmentedControl
                      :model-value="theme.settings.animation ? 'on' : 'off'"
                      :options="animationOptions"
                      :aria-label="t('theme.animations')"
                      @update:model-value="(v) => theme.setAnimations(v === 'on')"
                    />
                  </FineTuneCard>
                </div>

                <!-- Card style -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="dashboard" :title="t('theme.cardStyle')" :hint="t('theme.cardStyleHint')">
                    <SegmentedControl
                      :model-value="theme.cardStyle"
                      :options="cardStyleOptions"
                      :aria-label="t('theme.cardStyle')"
                      @update:model-value="theme.setCardStyle"
                    />
                  </FineTuneCard>
                </div>

                <!-- Navigation appearance -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="toolbar" :title="t('theme.navigationStyle')" :hint="t('theme.navigationStyleHint')">
                    <SegmentedControl
                      :model-value="theme.navigationStyle"
                      :options="navigationOptions"
                      :aria-label="t('theme.navigationStyle')"
                      @update:model-value="theme.setNavigationStyle"
                    />
                  </FineTuneCard>
                </div>

                <!-- Primary colour quick picker -->
                <div class="col-12 col-sm-6">
                  <FineTuneCard icon="colorize" :title="t('theme.primaryColor')" :hint="t('theme.primaryColorHint')">
                    <div class="row items-center q-gutter-xs">
                      <button
                        v-for="swatch in quickColors"
                        :key="swatch.value"
                        type="button"
                        class="qd"
                        :class="{ 'qd--active': isQuickActive(swatch.value) }"
                        :style="{ background: swatch.value }"
                        :aria-label="swatch.name"
                        :title="swatch.name"
                        @click="theme.updatePrimaryColor(swatch.value)"
                      >
                        <q-icon v-if="isQuickActive(swatch.value)" name="check" size="12px" :style="{ color: contrastFor(swatch.value) }" />
                      </button>

                      <q-btn flat dense round size="sm" class="qd-more" :aria-label="t('theme.custom')">
                        <q-icon name="color_lens" size="16px" />
                        <q-tooltip>{{ t('theme.custom') }}</q-tooltip>
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-color
                            :model-value="theme.colors.primary"
                            :palette="palette"
                            no-header-tabs
                            default-view="palette"
                            style="width: 250px"
                            @update:model-value="debouncedPrimary"
                          />
                        </q-popup-proxy>
                      </q-btn>
                    </div>
                  </FineTuneCard>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- ------------------------------------------------------------------
           Advanced sections
           ------------------------------------------------------------------ -->
      <q-card flat bordered class="ta-card q-mt-md">
        <!-- Customize colours -->
        <q-expansion-item
          v-model="openColors"
          group="ta-advanced"
          icon="palette"
          :label="t('theme.customizeColours')"
          header-class="ta-exp__header"
          :caption="customizedCount ? `${customizedCount} customised` : t('theme.revertToScheme')"
        >
          <q-separator />
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-caption text-grey-7">{{ t('theme.colourSchemeHint') }}</div>
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="undo"
                :label="t('theme.revertToScheme')"
                :disable="!customizedCount"
                data-cy="theme-revert-colours"
                @click="revertColors"
              />
            </div>

            <div v-for="group in colorGroups" :key="group.key" class="q-mb-md">
              <div class="ta-group-title">{{ t(`theme.colours.${group.key}`) }}</div>
              <div class="row q-col-gutter-sm">
                <div v-for="token in group.tokens" :key="token" class="col-12 col-sm-6 col-md-4">
                  <ColorTokenField
                    :model-value="theme.colors[token]"
                    :scheme-value="activeScheme.colors[token]"
                    :label="t(tokenLabelKey(token))"
                    :palette="palette"
                    :reset-label="t('theme.revertToScheme')"
                    :close-label="t('common.close')"
                    :invalid-message="t('common.invalidEmail') ? 'Enter a hex colour, e.g. #2E7D32' : ''"
                    @update:model-value="(v) => theme.updateCustomColor(token, v)"
                    @reset="theme.clearCustomColor(token)"
                  />
                </div>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <q-separator />

        <!-- Language & Typography -->
        <q-expansion-item
          v-model="openTypography"
          group="ta-advanced"
          icon="translate"
          :label="t('theme.languageTypography')"
          header-class="ta-exp__header"
          :caption="t('theme.languageTypographyHint')"
        >
          <q-separator />
          <q-card-section>
            <!-- ---------------------------------------------------------
                 Fonts per script: the interface must look equally polished
                 in English, Farsi, Dari, Pashto and Arabic.
                 --------------------------------------------------------- -->
            <div class="ta-group-title">{{ t('theme.fontFamilies') }}</div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-md-4">
                <q-select
                  :model-value="theme.settings.fontFamily"
                  :options="fontFamilyOptions"
                  :label="t('theme.latinFont')"
                  :hint="t('theme.latinFontHint')"
                  emit-value
                  map-options
                  options-dense
                  dense
                  outlined
                  data-cy="font-latin"
                  @update:model-value="theme.setFontFamily"
                >
                  <template #prepend><q-icon name="abc" /></template>
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps" :style="{ fontFamily: scope.opt.stack }">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption>The quick brown fox · 1234567890</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>

              <div class="col-12 col-md-4">
                <q-select
                  :model-value="typography.persianFont"
                  :options="persianFontOptions"
                  :label="t('theme.persianFont')"
                  :hint="t('theme.persianFontHint')"
                  emit-value
                  map-options
                  options-dense
                  dense
                  outlined
                  data-cy="font-persian"
                  @update:model-value="theme.setPersianFont"
                >
                  <template #prepend><q-icon name="language" /></template>
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps" :style="{ fontFamily: scope.opt.stack }">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption dir="rtl">{{ scope.opt.native }} · مدیریت دارایی‌ها · ۱۲۳۴۵۶</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>

              <div class="col-12 col-md-4">
                <q-select
                  :model-value="typography.arabicFont"
                  :options="arabicFontOptions"
                  :label="t('theme.arabicFont')"
                  :hint="t('theme.arabicFontHint')"
                  emit-value
                  map-options
                  options-dense
                  dense
                  outlined
                  data-cy="font-arabic"
                  @update:model-value="theme.setArabicFont"
                >
                  <template #prepend><q-icon name="translate" /></template>
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps" :style="{ fontFamily: scope.opt.stack }">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption dir="rtl">{{ scope.opt.native }} · إدارة الأصول · ١٢٣٤٥٦</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>
            </div>

            <!-- Metrics --------------------------------------------------- -->
            <div class="ta-group-title">{{ t('theme.textMetrics') }}</div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="format_size" :title="t('theme.fontSize')">
                  <SegmentedControl
                    :model-value="theme.settings.fontSize"
                    :options="fontSizeOptions"
                    :aria-label="t('theme.fontSize')"
                    @update:model-value="theme.setFontSize"
                  />
                </FineTuneCard>
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="format_letter_spacing" :title="t('theme.letterSpacing')">
                  <SegmentedControl
                    :model-value="typography.letterSpacing"
                    :options="letterSpacingOptions"
                    :aria-label="t('theme.letterSpacing')"
                    @update:model-value="theme.setLetterSpacing"
                  />
                </FineTuneCard>
              </div>
              <div class="col-6 col-sm-3 col-md-2">
                <q-input
                  :model-value="theme.settings.fontWeight"
                  type="number"
                  :label="t('theme.fontWeight')"
                  dense
                  outlined
                  min="300"
                  max="800"
                  step="100"
                  @update:model-value="(v) => theme.patch({ fontWeight: clamp(Number(v) || 400, 300, 800) })"
                />
              </div>
              <div class="col-6 col-sm-3 col-md-2">
                <q-input
                  :model-value="theme.settings.lineHeight"
                  type="number"
                  :label="t('theme.lineHeight')"
                  dense
                  outlined
                  min="1"
                  max="2.5"
                  step="0.05"
                  @update:model-value="(v) => theme.patch({ lineHeight: clamp(Number(v) || 1.55, 1, 2.5) })"
                />
              </div>
              <div class="col-12 col-sm-6 col-md-2">
                <q-select
                  :model-value="typography.headingWeight"
                  :options="headingWeightOptions"
                  :label="t('theme.headingWeight')"
                  emit-value
                  map-options
                  options-dense
                  dense
                  outlined
                  @update:model-value="theme.setHeadingWeight"
                />
              </div>
            </div>

            <!-- Numerals + RTL ------------------------------------------- -->
            <div class="ta-group-title">{{ t('theme.numbersDirection') }}</div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-md-5">
                <FineTuneCard icon="pin" :title="t('theme.numeralSystem')" :hint="t('theme.numeralSystemHint')">
                  <SegmentedControl
                    :model-value="typography.numerals"
                    :options="numeralOptions"
                    :aria-label="t('theme.numeralSystem')"
                    @update:model-value="theme.setNumerals"
                  />
                </FineTuneCard>
              </div>
              <div class="col-12 col-md-4">
                <FineTuneCard icon="swap_horiz" :title="t('theme.direction')" :hint="t('theme.directionHint')">
                  <div class="ta-static">
                    <q-icon :name="isRtl ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r'" size="18px" class="q-mr-xs" />
                    <span>{{ isRtl ? 'RTL' : 'LTR' }} · {{ currentLanguage.nativeName }}</span>
                  </div>
                </FineTuneCard>
              </div>
              <div class="col-12 col-md-3">
                <FineTuneCard icon="g_translate" :title="t('common.language')" :hint="t('theme.languageHint')">
                  <LanguageSwitcher mode="select" dense />
                </FineTuneCard>
              </div>
            </div>

            <!-- Ink -------------------------------------------------------
                 Font & link colour live with typography (not in the colour
                 palette) because that is where users look for them. Both are
                 ordinary theme tokens, so they persist and apply globally. -->
            <div class="ta-group-title">{{ t('theme.colours.typography') }}</div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-12 col-sm-6 col-md-3">
                <ColorTokenField
                  :model-value="theme.colors.text"
                  :scheme-value="activeScheme.colors.text"
                  :label="t('theme.fontColor')"
                  :hint="t('theme.fontColorHint')"
                  :palette="palette"
                  :reset-label="t('theme.revertToScheme')"
                  :close-label="t('common.close')"
                  @update:model-value="theme.setFontColor"
                  @reset="theme.clearFontColor"
                />
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <ColorTokenField
                  :model-value="theme.colors.link"
                  :scheme-value="activeScheme.colors.link"
                  :label="t('theme.linkColor')"
                  :hint="t('theme.linkColorHint')"
                  :palette="palette"
                  :reset-label="t('theme.revertToScheme')"
                  :close-label="t('common.close')"
                  @update:model-value="theme.setLinkColor"
                  @reset="theme.clearLinkColor"
                />
              </div>
            </div>

            <!-- Multilingual live sample ---------------------------------- -->
            <div class="ta-group-title">{{ t('theme.typePreview') }}</div>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-md-4">
                <div class="ta-sample" :style="latinSampleStyle">
                  <div class="ta-sample__tag">English · Latin</div>
                  <div class="ta-sample__title">{{ t('common.universityName') }}</div>
                  <div class="ta-sample__body">{{ t('common.appName') }} — assets, maintenance, reports.</div>
                  <div class="ta-sample__nums">1234567890 · 12,450 AFN</div>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <div class="ta-sample" dir="rtl" :style="persianSampleStyle">
                  <div class="ta-sample__tag">فارسی / دری · Farsi / Dari</div>
                  <div class="ta-sample__title">پوهنتون کابل</div>
                  <div class="ta-sample__body">سیستم مدیریت دارایی‌ها — دارایی‌ها، ترمیمات و راپورها.</div>
                  <div class="ta-sample__nums">۱۲۳۴۵۶۷۸۹۰ · ۱۲٬۴۵۰ افغانی</div>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <div class="ta-sample" dir="rtl" :style="arabicSampleStyle">
                  <div class="ta-sample__tag">العربية · Arabic</div>
                  <div class="ta-sample__title">جامعة كابول</div>
                  <div class="ta-sample__body">نظام إدارة الأصول — الأصول والصيانة والتقارير.</div>
                  <div class="ta-sample__nums">١٢٣٤٥٦٧٨٩٠ · ١٢٬٤٥٠</div>
                </div>
              </div>
            </div>

            <div class="app-caption q-mt-sm">
              <q-icon name="info_outline" size="14px" class="q-mr-xs" />
              {{ t('theme.rtlNote') }}
            </div>
          </q-card-section>
        </q-expansion-item>

        <q-separator />

        <!-- Layout preferences -->
        <q-expansion-item
          v-model="openLayout"
          group="ta-advanced"
          icon="dashboard_customize"
          :label="t('theme.layoutPreferences')"
          header-class="ta-exp__header"
          :caption="t('theme.layoutHint')"
        >
          <q-separator />
          <q-card-section>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="web_asset" :title="t('theme.headerBehaviour')">
                  <SegmentedControl
                    :model-value="theme.settings.layout?.header || 'fixed'"
                    :options="headerOptions"
                    @update:model-value="(v) => theme.setLayout({ header: v })"
                  />
                </FineTuneCard>
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="open_in_full" :title="t('theme.contentWidth')">
                  <SegmentedControl
                    :model-value="theme.settings.layout?.contentWidth || 'boxed'"
                    :options="contentWidthOptions"
                    @update:model-value="(v) => theme.setLayout({ contentWidth: v })"
                  />
                </FineTuneCard>
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="grid_view" :title="t('theme.dashboardLayout')">
                  <SegmentedControl
                    :model-value="theme.settings.layout?.dashboardDensity || 'comfortable'"
                    :options="densityOptions"
                    @update:model-value="(v) => theme.setLayout({ dashboardDensity: v })"
                  />
                </FineTuneCard>
              </div>
              <div class="col-12 col-sm-6 col-md-3">
                <FineTuneCard icon="swap_horiz" :title="t('theme.sidebarPosition')" :hint="t('theme.sidebarAuto')">
                  <div class="ta-static">
                    <q-icon :name="isRtl ? 'arrow_back' : 'arrow_forward'" size="18px" class="q-mr-xs" />
                    <span>{{ isRtl ? 'RTL' : 'LTR' }} · {{ isRtl ? t('common.right', 'Right') : t('common.left', 'Left') }}</span>
                  </div>
                </FineTuneCard>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <q-separator />

        <!-- Accessibility -->
        <q-expansion-item
          v-model="openA11y"
          group="ta-advanced"
          icon="accessibility_new"
          :label="t('theme.accessibility')"
          header-class="ta-exp__header"
          :caption="t('theme.accessibilityHint')"
        >
          <q-separator />
          <q-card-section>
            <div class="row q-col-gutter-sm">
              <div v-for="opt in accessibilityOptions" :key="opt.key" class="col-12 col-sm-6 col-md-4">
                <div class="ta-a11y">
                  <q-item tag="label" dense class="q-px-none">
                    <q-item-section avatar side>
                      <q-toggle
                        :model-value="Boolean(theme.settings.accessibility?.[opt.key])"
                        dense
                        color="primary"
                        :aria-label="opt.label"
                        @update:model-value="(v) => theme.setAccessibility({ [opt.key]: v })"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-body2 text-weight-medium">{{ opt.label }}</q-item-label>
                      <q-item-label caption>{{ opt.hint }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </div>
              </div>
            </div>
            <div class="text-caption text-grey-6 q-mt-sm">
              <q-icon name="info_outline" size="14px" class="q-mr-xs" />
              {{ t('theme.animationsHint') }} · <code>prefers-reduced-motion</code> / <code>prefers-color-scheme</code>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- Administrator: system-wide defaults ---------------------------- -->
        <template v-if="canManageSystem">
          <q-separator />
          <q-expansion-item
            v-model="openAdmin"
            group="ta-advanced"
            icon="admin_panel_settings"
            :label="t('theme.admin.title')"
            header-class="ta-exp__header"
            :caption="t('theme.admin.subtitle')"
          >
            <q-separator />
            <q-card-section>
              <q-banner dense rounded class="bg-grey-2 text-grey-9 q-mb-md">
                <template #avatar><q-icon name="lock" color="primary" /></template>
                {{ t('theme.admin.onlyAdmins') }}
              </q-banner>

              <div class="row q-col-gutter-sm">
                <div class="col-12 col-sm-6 col-md-4">
                  <q-select
                    v-model="adminDraft.selected_theme"
                    :options="schemeOptions"
                    :label="t('theme.admin.defaultTheme')"
                    emit-value
                    map-options
                    options-dense
                    dense
                    outlined
                  />
                </div>
                <div class="col-12 col-sm-6 col-md-4">
                  <q-select
                    v-model="adminDraft.theme_mode"
                    :options="modeOptions"
                    :label="t('theme.admin.defaultMode')"
                    emit-value
                    map-options
                    options-dense
                    dense
                    outlined
                  />
                </div>
                <div class="col-12 col-sm-6 col-md-4">
                  <ColorTokenField
                    v-model="adminPrimary"
                    :label="t('theme.admin.defaultPrimary')"
                    :show-reset="false"
                    :palette="palette"
                    @update:model-value="(v) => (adminDraft.custom_colors = { ...(adminDraft.custom_colors || {}), primary: v })"
                  />
                </div>
                <div class="col-12 col-sm-6 col-md-4">
                  <q-select
                    v-model="adminDraft.font_family"
                    :options="fontFamilyOptions"
                    :label="t('theme.admin.defaultFont')"
                    emit-value
                    map-options
                    options-dense
                    dense
                    outlined
                  />
                </div>
                <div class="col-12 col-sm-6 col-md-4">
                  <q-select
                    v-model="adminDraft.sidebar_style"
                    :options="sidebarOptions"
                    :label="t('theme.admin.defaultSidebar')"
                    emit-value
                    map-options
                    options-dense
                    dense
                    outlined
                  />
                </div>
                <div class="col-12 col-sm-6 col-md-4">
                  <q-select
                    v-model="adminDraft.table_density"
                    :options="densityOptions"
                    :label="t('theme.tableDensity')"
                    emit-value
                    map-options
                    options-dense
                    dense
                    outlined
                  />
                </div>

                <q-separator spaced class="q-my-sm" />

                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="adminBranding.organizationName"
                    :label="t('theme.admin.organizationName')"
                    dense
                    outlined
                    maxlength="180"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="adminBranding.brandName"
                    :label="t('theme.admin.brandName')"
                    dense
                    outlined
                    maxlength="180"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="adminBranding.logoUrl"
                    :label="t('theme.admin.systemLogo')"
                    dense
                    outlined
                    type="url"
                    maxlength="255"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="adminBranding.faviconUrl"
                    :label="t('theme.admin.favicon')"
                    dense
                    outlined
                    type="url"
                    maxlength="255"
                  />
                </div>

                <div class="col-12 row justify-end q-gutter-sm q-mt-sm">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="grey-8"
                    icon="restart_alt"
                    :label="t('common.reset')"
                    :disable="savingSystem"
                    @click="loadAdminDraft"
                  />
                  <q-btn
                    unelevated
                    dense
                    no-caps
                    color="primary"
                    icon="publish"
                    :label="t('theme.admin.publish')"
                    :loading="savingSystem"
                    data-cy="theme-admin-save"
                    @click="saveSystemDefaults"
                  />
                </div>
              </div>
            </q-card-section>
          </q-expansion-item>
        </template>
      </q-card>
    </template>

    <!-- Sticky action bar -------------------------------------------------- -->
    <div class="ta-actions print-hide" :class="{ 'ta-actions--dirty': dirty }">
      <div class="row items-center q-col-gutter-sm no-wrap">
        <div class="col min-width-0">
          <div class="text-caption ellipsis">
            <q-icon :name="dirty ? 'warning_amber' : 'check_circle'" size="14px" class="q-mr-xs" />
            {{ dirty ? t('theme.unsaved') : t('theme.saved') }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            flat
            dense
            no-caps
            color="grey-8"
            icon="undo"
            :label="t('theme.cancelChanges')"
            :disable="!dirty || saving"
            data-cy="theme-cancel"
            @click="onCancel"
          />
          <q-btn
            unelevated
            dense
            no-caps
            color="primary"
            icon="save"
            :label="saving ? t('common.saving') : t('theme.save')"
            :loading="saving"
            :disable="!dirty"
            class="q-ml-sm"
            data-cy="theme-save"
            @click="onSave"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * ---------------------------------------------------------------------------
 * Theme & Appearance — the application-wide appearance management centre.
 * ---------------------------------------------------------------------------
 *
 * Every control writes straight into the theme store's PREVIEW state, which
 * applies CSS custom properties to <html> immediately — so the live preview
 * AND the real application re-skin as the user drags a colour, with no reload
 * and no save required.
 *
 *   Save              → PUT /appearance  → saved state = preview → ✓ notify
 *   Discard changes   → preview = saved state (last persisted)
 *   Reset to default  → confirm → POST /appearance/reset → org/app defaults
 *   Revert colours    → drop the manual overrides of the selected scheme
 *   Publish defaults  → PUT /admin/appearance (administrators only)
 *
 * Persistence priority: user → organization → application defaults
 * (see src/stores/theme.js). localStorage only caches the last known good
 * value so the first paint is already themed.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPageHeader from 'src/components/common/AppPageHeader.vue'
import FineTuneCard from 'src/components/theme/FineTuneCard.vue'
import SegmentedControl from 'src/components/theme/SegmentedControl.vue'
import ThemeCard from 'src/components/theme/ThemeCard.vue'
import ThemePreview from 'src/components/theme/ThemePreview.vue'
import ColorTokenField from 'src/components/theme/ColorTokenField.vue'
import { useThemeStore } from 'src/stores/theme'
import { useAuthStore } from 'src/stores/auth'
import { useLanguage } from 'src/composables/useLanguage'
import LanguageSwitcher from 'src/components/common/LanguageSwitcher.vue'
import { useTheme } from 'src/composables/useTheme'
import { notify } from 'src/utils/notify'
import { useAction } from 'src/composables/useAction'
import { confirmAction } from 'src/utils/confirm'
import { debounce } from 'src/utils/timing'
import { COLOR_TOKENS, QUICK_COLORS, contrastText, fontStackFor, normaliseHex } from 'src/config/themes'

const { t } = useI18n()
const theme = useThemeStore()
const authStore = useAuthStore()
const { isRtl, currentLanguage } = useLanguage()
const {
  modeOptions,
  fontSizeOptions,
  radiusOptions,
  sidebarOptions,
  densityOptions,
  calendarOptions,
  animationOptions,
  headerOptions,
  contentWidthOptions,
  accessibilityOptions,
  colorGroups,
  fontFamilyOptions,
  persianFontOptions,
  arabicFontOptions,
  letterSpacingOptions,
  numeralOptions,
  cardStyleOptions,
  navigationOptions,
  headingWeightOptions,
  schemeOptions,
  palette,
  tokenLabelKey,
} = useTheme()

const loading = ref(false)
const loaded = ref(false)

/**
 * One action lifecycle per save target: the visitor's own appearance and the
 * admin system defaults are independent requests and must never block or
 * overwrite each other's loading state.
 */
const saveAction = useAction()
const systemAction = useAction()
const saving = saveAction.pending
const savingSystem = systemAction.pending

const openColors = ref(false)
const openTypography = ref(false)
const openLayout = ref(false)
const openA11y = ref(false)
const openAdmin = ref(false)

const schemes = computed(() => theme.schemes)
const quickColors = computed(() => QUICK_COLORS)
const activeScheme = computed(() => theme.activeScheme)
const dirty = computed(() => theme.isDirty)
const canManageSystem = computed(() => theme.canManageSystem && authStore.hasPermission('settings.manage'))
const customizedCount = computed(() => Object.keys(theme.settings.custom || {}).filter((k) => COLOR_TOKENS.includes(k)).length)
const brandLabel = computed(() => theme.systemBranding?.brandName || theme.systemBranding?.organizationName || t('theme.previewBrand'))

const headerMeta = computed(() => [
  { icon: 'style', label: activeScheme.value?.name || '' },
  { icon: theme.isDark ? 'dark_mode' : 'light_mode', label: t(`theme.${theme.resolvedMode}`) },
])

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** Live typography preferences (Language & Typography section). */
const typography = computed(() => theme.typography)

const sampleBase = computed(() => ({
  color: theme.colors.text,
  fontWeight: String(theme.settings.fontWeight || 400),
  lineHeight: String(theme.settings.lineHeight || 1.55),
}))

const latinSampleStyle = computed(() => ({ ...sampleBase.value, fontFamily: theme.fontStackValue }))
const persianSampleStyle = computed(() => ({ ...sampleBase.value, fontFamily: fontStackFor('persian', typography.value.persianFont) }))
const arabicSampleStyle = computed(() => ({ ...sampleBase.value, fontFamily: fontStackFor('arabic', typography.value.arabicFont) }))
const contrastFor = (hex) => contrastText(hex)

function isQuickActive(hex) {
  return normaliseHex(hex) === normaliseHex(theme.colors.primary)
}

function selectScheme(id) {
  theme.selectPreset(id)
}

// Colour-picker drags fire continuously — debounce the write so we do not
// thrash the store (and later the API) while the user is still dragging.
const debouncedPrimary = debounce((value) => {
  if (normaliseHex(value)) theme.updatePrimaryColor(value)
}, 120)

function revertColors() {
  theme.restorePresetColors()
  notify.info(t('theme.reverted'))
}

function onCancel() {
  theme.cancel()
  debouncedPrimary.cancel()
  notify.info(t('theme.discarded'))
}

function onSave() {
  if (!dirty.value) return Promise.resolve({ ok: false, skipped: true })

  // Flush any pending debounced colour write so the payload matches the preview.
  debouncedPrimary.flush(undefined)

  return saveAction.run(
    async () => {
      // `savePreferences` RESOLVES with `{ ok: false, error }` instead of
      // throwing, so a failed persist has to be turned back into a rejection —
      // otherwise the lifecycle would report success and toast it.
      const result = await theme.savePreferences({ silent: true })
      if (!result?.ok) throw result?.error || new Error(t('theme.saveFailed'))
      return result
    },
    {
      successMessage: t('theme.saved'),
      errorMessage: t('theme.saveFailed'),
    },
  )
}

async function onResetToDefault() {
  const ok = await confirmAction({
    title: t('theme.resetConfirmTitle'),
    message: t('theme.resetConfirmMessage'),
    okLabel: t('theme.resetToDefault'),
    busyLabel: t('common.working'),
    icon: 'restart_alt',
    color: 'negative',
    onConfirm: () => theme.resetToDefault({ silent: true }),
    onConfirmed: () => notify.success(t('theme.restored')),
  })
  return ok
}

// -- Administrator defaults -------------------------------------------------
const adminDraft = reactive({})
const adminBranding = reactive({ organizationName: '', brandName: '', logoUrl: '', faviconUrl: '' })
const adminPrimary = ref('#2563EB')

function loadAdminDraft() {
  const source = theme.system || {}
  Object.keys(adminDraft).forEach((k) => delete adminDraft[k])
  Object.assign(adminDraft, {
    selected_theme: source.schemeId || 'softcora',
    theme_mode: source.mode || 'system',
    font_family: source.fontFamily || 'inter',
    sidebar_style: source.sidebar || 'normal',
    table_density: source.tableDensity || 'compact',
    custom_colors: source.custom ? { ...source.custom } : null,
  })
  Object.assign(adminBranding, {
    organizationName: theme.systemBranding?.organizationName || '',
    brandName: theme.systemBranding?.brandName || '',
    logoUrl: theme.systemBranding?.logoUrl || '',
    faviconUrl: theme.systemBranding?.faviconUrl || '',
  })
  adminPrimary.value = normaliseHex(adminDraft.custom_colors?.primary) || '#2563eb'
}

function saveSystemDefaults() {
  const payload = {
    defaults: {
      schemeId: adminDraft.selected_theme,
      mode: adminDraft.theme_mode,
      fontFamily: adminDraft.font_family,
      sidebar: adminDraft.sidebar_style,
      tableDensity: adminDraft.table_density,
      custom: adminDraft.custom_colors,
    },
    branding: {
      organization_name: adminBranding.organizationName,
      brand_name: adminBranding.brandName,
      logo_url: adminBranding.logoUrl,
      favicon_url: adminBranding.faviconUrl,
    },
  }

  return systemAction.run(() => theme.saveSystemDefaults(payload), {
    successMessage: t('theme.admin.saved'),
    errorMessage: t('theme.admin.saveFailed'),
    // Re-read the stored defaults so the admin panel shows what the server
    // actually persisted, not what was typed.
    onSuccess: () => loadAdminDraft(),
  })
}

// Keep the admin panel in sync when the org defaults arrive from the API.
watch(() => theme.system, loadAdminDraft, { deep: true })

// Warn before leaving with unsaved appearance changes.
function beforeUnload(event) {
  if (!theme.isDirty) return undefined
  event.preventDefault()
  event.returnValue = ''
  return ''
}

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  loaded.value = theme.loaded
  loading.value = true
  try {
    await theme.loadTheme({ silent: true })
    loaded.value = true
    if (canManageSystem.value) await theme.loadSystemDefaults()
  } finally {
    loading.value = false
    loadAdminDraft()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  debouncedPrimary.cancel()
})
</script>

<style lang="sass" scoped>
.ta-page
  padding-bottom: 76px

.ta-card
  border-radius: var(--app-radius-lg)
  border-color: var(--app-border)

  &__head
    display: flex
    align-items: flex-start
    padding: 12px 14px

  &__icon
    color: var(--app-primary)
    margin-top: 1px

  &__title
    font-size: 13px
    font-weight: 700
    color: var(--app-text-primary)

  &__hint
    font-size: 11.5px
    color: var(--app-text-secondary)
    margin-top: 1px

.ta-exp__header
  padding: 10px 14px
  min-height: 46px

  :deep(.q-item__label)
    font-size: 13px
    font-weight: 700

  :deep(.q-item__label--caption)
    font-size: 11.5px
    font-weight: 400

.ta-group-title
  font-size: 11px
  font-weight: 800
  letter-spacing: .6px
  text-transform: uppercase
  color: var(--app-text-secondary)
  border-bottom: 1px solid var(--app-border)
  padding-bottom: 4px
  margin-bottom: 8px

.ta-sample
  height: 100%
  padding: 12px 14px
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius)
  background: var(--app-surface)
  transition: border-color var(--app-transition-fast)

  &:hover
    border-color: color-mix(in srgb, var(--app-primary) 32%, var(--app-border))

  &__tag
    font-size: var(--app-text-caption)
    font-weight: 700
    letter-spacing: .04em
    text-transform: uppercase
    color: var(--app-text-secondary)
    margin-bottom: 6px

  &__title
    font-size: 1.05rem
    font-weight: 700
    color: inherit

  &__body
    font-size: var(--app-text-body)
    margin-top: 2px

  &__nums
    margin-top: 6px
    font-size: var(--app-text-small)
    font-variant-numeric: tabular-nums
    color: var(--app-text-secondary)

.ta-a11y
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius)
  padding: 4px 10px
  background: var(--app-surface)
  height: 100%

.ta-static
  display: flex
  align-items: center
  padding: 7px 10px
  border: 1px dashed var(--app-border)
  border-radius: var(--app-radius)
  color: var(--app-text-secondary)
  font-size: 12px
  font-weight: 600

.min-width-0
  min-width: 0

// Primary-colour quick dots
.qd
  width: 24px
  height: 24px
  min-width: 24px
  border-radius: 50%
  border: 2px solid transparent
  cursor: pointer
  display: inline-flex
  align-items: center
  justify-content: center
  box-shadow: var(--ku-shadow-sm)
  transition: transform .12s ease, border-color .12s ease
  padding: 0

  &:hover
    transform: scale(1.12)

  &:focus-visible
    outline: 2px solid var(--app-text-primary)
    outline-offset: 2px

  &--active
    border-color: var(--app-text-primary)
    transform: scale(1.12)

.qd-more
  color: var(--app-text-secondary)
  border: 1px dashed var(--app-border)

// Sticky save bar
.ta-actions
  position: sticky
  bottom: 0
  z-index: 20
  margin-top: 14px
  padding: 8px 12px
  background: color-mix(in srgb, var(--app-card) 92%, transparent)
  border: 1px solid var(--app-border)
  border-radius: var(--app-radius-lg)
  box-shadow: var(--ku-shadow-md)
  backdrop-filter: blur(6px)

  &--dirty
    border-color: color-mix(in srgb, var(--app-warning) 55%, var(--app-border))
</style>
