/**
 * ---------------------------------------------------------------------------
 * i18n — Appearance / design-system extensions
 * ---------------------------------------------------------------------------
 * Keys introduced by the 2026 UI redesign:
 *
 *   · Language & Typography (Latin / Farsi–Dari / Arabic fonts, metrics,
 *     numerals, direction)
 *   · Interface preferences (card style, navigation appearance)
 *
 * Deep-merged into the locale bundles by `src/i18n/index.js`, exactly like
 * `extensions.js` and `ui.extensions.js`, so the base bundles stay easy to
 * diff. Every key exists in all four languages (en, fa, ps, ar) — a missing key
 * falls back to English and would leak Latin text into the RTL interface.
 */

export const appearanceExtensions = {
  // ---------------------------------------------------------------- English
  en: {
    theme: {
      // Language & typography
      languageTypography: 'Language & Typography',
      languageTypographyHint: 'Fonts for English, Farsi/Dari and Arabic, text metrics, numerals and direction.',
      fontFamilies: 'Font families',
      latinFont: 'English / Latin font',
      latinFontHint: 'Used for Latin text, numbers and codes.',
      persianFont: 'Farsi / Dari font',
      persianFontHint: 'Vazirmatn is recommended — modern and highly readable.',
      arabicFont: 'Arabic font',
      arabicFontHint: 'Also used as the fallback for Pashto text.',
      multilingual: 'Multilingual',
      textMetrics: 'Text metrics',
      letterSpacing: 'Letter spacing',
      headingWeight: 'Heading weight',
      numbersDirection: 'Numbers & direction',
      numeralSystem: 'Numbers',
      numeralSystemHint: 'Digit style used in tables, KPIs, dates and amounts.',
      direction: 'Text direction',
      directionHint: 'Follows the selected interface language automatically.',
      languageHint: 'Switching language also switches fonts and direction.',
      typePreview: 'Live type preview',
      rtlNote: 'Farsi, Dari, Pashto and Arabic automatically switch the whole interface to right-to-left: navigation, sidebar, tables, forms, dialogs and icons all mirror.',
      spacing: {
        tight: 'Tight',
        normal: 'Normal',
        relaxed: 'Relaxed',
        wide: 'Wide',
      },
      numerals: {
        auto: 'Auto',
        autoHint: 'Persian digits for Farsi/Dari and Pashto, Arabic-Indic for Arabic.',
      },
      // Interface
      cardStyle: 'Card style',
      cardStyleHint: 'Surface treatment of cards and panels.',
      cardElevated: 'Elevated',
      cardFlat: 'Flat',
      cardOutlined: 'Outlined',
      navigationStyle: 'Navigation',
      navigationStyleHint: 'Appearance of the top bar.',
      navSolid: 'Solid',
      navPrimary: 'Brand',
      navLight: 'Light',
    },
  },

  // --------------------------------------------------------- Farsi / Dari
  fa: {
    theme: {
      languageTypography: 'زبان و تایپوگرافی',
      languageTypographyHint: 'فونت‌ها برای انگلیسی، فارسی/دری و عربی، اندازهٔ متن، اعداد و جهت نوشتار.',
      fontFamilies: 'خانواده‌های فونت',
      latinFont: 'فونت انگلیسی / لاتین',
      latinFontHint: 'برای متن لاتین، اعداد و کدها استفاده می‌شود.',
      persianFont: 'فونت فارسی / دری',
      persianFontHint: 'وزیرمتن پیشنهاد می‌شود — مدرن و بسیار خوانا.',
      arabicFont: 'فونت عربی',
      arabicFontHint: 'به‌عنوان فونت جایگزین برای متن پشتو نیز به کار می‌رود.',
      multilingual: 'چندزبانه',
      textMetrics: 'اندازه و فاصلهٔ متن',
      letterSpacing: 'فاصلهٔ حروف',
      headingWeight: 'ضخامت عناوین',
      numbersDirection: 'اعداد و جهت',
      numeralSystem: 'اعداد',
      numeralSystemHint: 'شکل ارقام در جدول‌ها، شاخص‌ها، تاریخ‌ها و مبالغ.',
      direction: 'جهت نوشتار',
      directionHint: 'به‌صورت خودکار از زبان انتخاب‌شده پیروی می‌کند.',
      languageHint: 'تغییر زبان، فونت و جهت را نیز تغییر می‌دهد.',
      typePreview: 'پیش‌نمایش زنده',
      rtlNote: 'فارسی، دری، پشتو و عربی به‌صورت خودکار تمام رابط کاربری را راست‌چین می‌کنند: منو، نوار کناری، جدول‌ها، فرم‌ها، دیالوگ‌ها و آیکون‌ها همگی قرینه می‌شوند.',
      spacing: {
        tight: 'فشرده',
        normal: 'عادی',
        relaxed: 'باز',
        wide: 'خیلی باز',
      },
      numerals: {
        auto: 'خودکار',
        autoHint: 'ارقام فارسی برای فارسی/دری و پشتو، ارقام عربی برای عربی.',
      },
      cardStyle: 'سبک کارت',
      cardStyleHint: 'نحوهٔ نمایش سطح کارت‌ها و پنل‌ها.',
      cardElevated: 'سایه‌دار',
      cardFlat: 'ساده',
      cardOutlined: 'خط‌دار',
      navigationStyle: 'نوار بالا',
      navigationStyleHint: 'ظاهر نوار بالای برنامه.',
      navSolid: 'تیره',
      navPrimary: 'رنگ برند',
      navLight: 'روشن',
    },
  },

  // -------------------------------------------------------------- Pashto
  ps: {
    theme: {
      languageTypography: 'ژبه او ټایپوګرافي',
      languageTypographyHint: 'د انګلیسي، فارسي/دري او عربي فونټونه، د متن اندازه، شمېرې او لوري.',
      fontFamilies: 'د فونټ کورنۍ',
      latinFont: 'انګلیسي / لاتین فونټ',
      latinFontHint: 'د لاتین متن، شمېرو او کوډونو لپاره کارېږي.',
      persianFont: 'فارسي / دري فونټ',
      persianFontHint: 'وزیرمتن وړاندیز کېږي — عصري او ډېر لوستل کېدونکی.',
      arabicFont: 'عربي فونټ',
      arabicFontHint: 'د پښتو متن لپاره هم د بدیل په توګه کارېږي.',
      multilingual: 'څوژبنی',
      textMetrics: 'د متن اندازې',
      letterSpacing: 'د تورو واټن',
      headingWeight: 'د سرلیک ضخامت',
      numbersDirection: 'شمېرې او لوري',
      numeralSystem: 'شمېرې',
      numeralSystemHint: 'په جدولونو، شاخصونو، نېټو او پیسو کې د ارقامو بڼه.',
      direction: 'د متن لوري',
      directionHint: 'په اتوماتيک ډول د ټاکل شوې ژبې پیروي کوي.',
      languageHint: 'د ژبې بدلول فونټ او لوري هم بدلوي.',
      typePreview: 'ژوندی مخکتنه',
      rtlNote: 'فارسي، دري، پښتو او عربي ټوله بېلګه ښي‌لوري ته اړوي: مینو، څنګ پټه، جدولونه، فورمې، ډیالوګونه او آیکونونه ټول انعکاس کېږي.',
      spacing: {
        tight: 'نږدې',
        normal: 'عادي',
        relaxed: 'خلاص',
        wide: 'ډېر خلاص',
      },
      numerals: {
        auto: 'اتوماتيک',
        autoHint: 'د فارسي/دري او پښتو لپاره فارسي ارقام، د عربي لپاره عربي ارقام.',
      },
      cardStyle: 'د کارت بڼه',
      cardStyleHint: 'د کارتونو او پینلونو د سطحې بڼه.',
      cardElevated: 'سیوری‌لرونکی',
      cardFlat: 'ساده',
      cardOutlined: 'کرښه‌لرونکی',
      navigationStyle: 'پورتنۍ پټه',
      navigationStyleHint: 'د پورتنۍ پټې بڼه.',
      navSolid: 'تیاره',
      navPrimary: 'د برند رنګ',
      navLight: 'روښانه',
    },
  },

  // -------------------------------------------------------------- Arabic
  ar: {
    theme: {
      languageTypography: 'اللغة والخطوط',
      languageTypographyHint: 'خطوط الإنجليزية والفارسية/الدرية والعربية، ومقاييس النص والأرقام والاتجاه.',
      fontFamilies: 'عائلات الخطوط',
      latinFont: 'الخط اللاتيني / الإنجليزي',
      latinFontHint: 'يُستخدم للنص اللاتيني والأرقام والرموز.',
      persianFont: 'الخط الفارسي / الدري',
      persianFontHint: 'يُنصح بخط Vazirmatn — عصري وواضح جدًا.',
      arabicFont: 'الخط العربي',
      arabicFontHint: 'يُستخدم أيضًا كخط احتياطي للنص البشتوي.',
      multilingual: 'متعدد اللغات',
      textMetrics: 'مقاييس النص',
      letterSpacing: 'تباعد الأحرف',
      headingWeight: 'سماكة العناوين',
      numbersDirection: 'الأرقام والاتجاه',
      numeralSystem: 'الأرقام',
      numeralSystemHint: 'شكل الأرقام في الجداول والمؤشرات والتواريخ والمبالغ.',
      direction: 'اتجاه النص',
      directionHint: 'يتبع لغة الواجهة المختارة تلقائيًا.',
      languageHint: 'تغيير اللغة يغيّر الخط والاتجاه أيضًا.',
      typePreview: 'معاينة حية للخطوط',
      rtlNote: 'الفارسية والدرية والبشتو والعربية تحوّل الواجهة بالكامل إلى اتجاه من اليمين إلى اليسار: التنقل والشريط الجانبي والجداول والنماذج والحوارات والأيقونات.',
      spacing: {
        tight: 'ضيق',
        normal: 'عادي',
        relaxed: 'مريح',
        wide: 'واسع',
      },
      numerals: {
        auto: 'تلقائي',
        autoHint: 'أرقام فارسية للفارسية/الدرية والبشتو، وأرقام عربية هندية للعربية.',
      },
      cardStyle: 'نمط البطاقات',
      cardStyleHint: 'شكل سطح البطاقات واللوحات.',
      cardElevated: 'بظل',
      cardFlat: 'مسطح',
      cardOutlined: 'محدد بإطار',
      navigationStyle: 'شريط التنقل',
      navigationStyleHint: 'مظهر الشريط العلوي.',
      navSolid: 'داكن',
      navPrimary: 'لون العلامة',
      navLight: 'فاتح',
    },
  },
}

export default appearanceExtensions
