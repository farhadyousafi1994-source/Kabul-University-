/**
 * ---------------------------------------------------------------------------
 * Report lexicon — multilingual vocabulary for "Ask Your Data"
 * ---------------------------------------------------------------------------
 *
 * The natural-language layer is deliberately *deterministic and offline*: the
 * question is matched against this lexicon to produce a structured Report
 * Query Object, which the server then validates against its own allowlist.
 * No user text is ever turned into SQL, and no data leaves the installation.
 *
 * Every entry is a flat list of surface forms in ALL supported languages.
 * Matching is language-agnostic (the whole lexicon is searched regardless of
 * the active locale), which means a Dari user can still paste an English
 * question — and adding a new language only means appending its words here.
 *
 * Terms must be written *normalised*: lowercase, Arabic/Persian letters folded
 * (ي→ی, ك→ک, ة→ه), Latin digits, no diacritics. See `normaliseText()` in
 * `src/utils/reportNlu.js`, which applies exactly the same transformation to
 * the user's question before matching.
 * ---------------------------------------------------------------------------
 */

/** Data source (module) vocabulary → catalog module id. */
export const MODULE_TERMS = {
  assets: [
    'asset', 'assets', 'equipment', 'property', 'properties', 'item', 'items', 'inventory', 'register', 'stock of assets',
    'دارایی', 'دارایی ها', 'داراییها', 'دارائی', 'اموال', 'تجهیزات', 'اثاثیه', 'اجناس', 'وسایل', 'ملکیت',
    'شتمنی', 'شتمنۍ', 'توکي', 'توکی', 'سامان',
    'أصول', 'الاصول', 'اصول', 'معدات', 'ممتلکات', 'موجودات',
  ],
  assignments: [
    'assignment', 'assignments', 'assigned', 'allocation', 'allocated', 'issued to', 'custody', 'handover',
    'تخصیص', 'واگذاری', 'تحویل', 'سپردن', 'تخصیص یافته', 'واگذار',
    'ورکړه', 'سپارل', 'تسلیمی',
    'تخصیصات', 'تسلیم', 'عهده',
  ],
  maintenance: [
    'maintenance', 'repair', 'repairs', 'service', 'servicing', 'work order', 'work orders', 'breakdown',
    'ترمیم', 'تعمیر', 'تعمیرات', 'نگهداری', 'مراقبت', 'سرویس', 'کار ترمیم',
    'ساتنه', 'جوړول', 'مرمت',
    'صیانه', 'الصیانه', 'اصلاح', 'تصلیح',
  ],
  procurement: [
    'purchase', 'purchases', 'purchasing', 'procurement', 'purchase order', 'purchase orders', 'po', 'buying', 'bought', 'spend', 'spending',
    'خرید', 'خریداری', 'خریدها', 'تدارکات', 'سفارش', 'سفارشات', 'فرمایش', 'مصارف خرید',
    'پیرودنه', 'پیرود', 'اخیستل', 'رانیول',
    'مشتریات', 'شراء', 'الشراء', 'طلبات', 'امر شراء',
  ],
  purchase_items: [
    'purchased item', 'purchased items', 'order item', 'order items', 'line item', 'line items', 'most purchased', 'top purchased',
    'اقلام خرید', 'اقلام', 'قلم خرید', 'جنس خریداری شده', 'مواد خریداری',
    'د پیرود توکي', 'پیرودل شوي توکي',
    'اصناف الشراء', 'بنود الشراء', 'المواد المشتراه',
  ],
  warehouse: [
    'warehouse', 'warehouses', 'store', 'stores', 'stock', 'stock movement', 'stock movements', 'inbound', 'outbound', 'transaction', 'transactions',
    'انبار', 'انبارها', 'گدام', 'گدام ها', 'ذخیره', 'موجودی', 'حرکت اجناس', 'ورود و خروج',
    'ګدام', 'ګودام', 'زیرمه', 'ذخیره ځای',
    'مستودع', 'المستودع', 'مخزن', 'المخزن', 'حرکه المخزون',
  ],
  depreciation: [
    'depreciation', 'depreciated', 'book value', 'amortization', 'amortisation',
    'استهلاک', 'استهلاکات', 'کاهش ارزش', 'ارزش دفتری',
    'استهلاک ارزښت', 'دفتري ارزښت',
    'اهلاک', 'الاهلاک', 'القیمه الدفتریه',
  ],
  disposals: [
    'disposal', 'disposals', 'disposed', 'scrapped', 'scrap', 'retired', 'write off', 'written off', 'sold asset',
    'دفع', 'اسقاط', 'حذف دارایی', 'فروش دارایی', 'از رده خارج',
    'له کاره ایستل', 'خرڅول',
    'اتلاف', 'التخلص', 'شطب', 'بیع الاصول',
  ],
  incidents: [
    'incident', 'incidents', 'damage', 'damaged', 'loss', 'lost', 'theft', 'stolen', 'broken', 'malfunction', 'problem',
    'حادثه', 'حوادث', 'خرابی', 'آسیب', 'گم شده', 'مفقود', 'سرقت', 'دزدی', 'خسارت',
    'پیښه', 'زیان', 'ورک شوی', 'غلا',
    'حادث', 'حوادث', 'ضرر', 'تلف', 'سرقه', 'عطل',
  ],
  employees: [
    'employee', 'employees', 'staff', 'personnel', 'workforce', 'human resources', 'hr', 'headcount',
    'کارمند', 'کارمندان', 'کارکنان', 'پرسونل', 'منابع بشری', 'استخدام',
    'کارکوونکي', 'کارکوونکی', 'بشري سرچینې',
    'موظف', 'الموظفین', 'موظفین', 'الموارد البشریه',
  ],
  transfers: [
    'transfer', 'transfers', 'moved', 'movement between', 'relocation',
    'انتقال', 'انتقالات', 'جابجایی', 'نقل مکان',
    'لیږد', 'لیږدونه',
    'نقل', 'التحویل', 'نقل الاصول',
  ],
}

/**
 * Semantic metric buckets. `MODULE_METRICS` maps each bucket onto the concrete
 * metric id of a module, so "total" means purchase value for assets and order
 * value for procurement without the user having to know either name.
 */
export const METRIC_TERMS = {
  count: [
    'how many', 'how much count', 'count', 'number of', 'total number', 'quantity of records', 'headcount',
    'چند', 'چند تا', 'تعداد', 'شمار', 'شمارش', 'مجموع تعداد',
    'څومره', 'شمېر', 'شمیر', 'څو',
    'کم', 'عدد', 'العدد', 'اجمالی العدد',
  ],
  amount: [
    'total', 'total value', 'total amount', 'amount', 'value', 'worth', 'spend', 'spent', 'sum',
    'مجموع', 'جمع', 'مبلغ', 'ارزش', 'قیمت', 'کل', 'مجموعه', 'ارزش کل',
    'ټول', 'ټوله', 'ارزښت', 'بیه',
    'اجمالی', 'الاجمالی', 'مجموع', 'قیمه', 'المبلغ',
  ],
  cost: [
    'cost', 'costs', 'expense', 'expenses', 'expenditure',
    'هزینه', 'هزینه ها', 'مصرف', 'مصارف', 'قیمت ترمیم',
    'لګښت', 'لګښتونه', 'مصرف',
    'تکلفه', 'التکالیف', 'مصروف', 'نفقات',
  ],
  revenue: [
    'revenue', 'income', 'proceeds', 'earnings', 'sales value',
    'عاید', 'عواید', 'درآمد', 'درامد', 'فروش',
    'عاید', 'ګټه',
    'ایراد', 'الایرادات', 'دخل', 'العائد',
  ],
  quantity: [
    'quantity', 'qty', 'units', 'pieces', 'volume',
    'مقدار', 'کمیت', 'تعداد اقلام', 'واحد',
    'اندازه', 'مقدار',
    'کمیه', 'الکمیه', 'وحدات',
  ],
  average: [
    'average', 'avg', 'mean', 'per unit average',
    'میانگین', 'اوسط', 'معدل', 'بطور اوسط',
    'اوسط', 'منځنی',
    'متوسط', 'المتوسط', 'معدل',
  ],
  current_value: [
    'current value', 'book value', 'net value', 'remaining value',
    'ارزش فعلی', 'ارزش دفتری', 'ارزش باقیمانده',
    'اوسنی ارزښت',
    'القیمه الحالیه', 'القیمه الدفتریه',
  ],
}

/** Bucket → concrete metric id, per module (unknown buckets fall back to count). */
export const MODULE_METRICS = {
  assets: { count: 'count', amount: 'purchase_value', cost: 'purchase_value', current_value: 'current_value', average: 'avg_price', quantity: 'count', revenue: 'purchase_value' },
  assignments: { count: 'count', quantity: 'count', amount: 'count' },
  maintenance: { count: 'count', cost: 'total_cost', amount: 'total_cost', average: 'avg_cost', quantity: 'count' },
  procurement: { count: 'count', amount: 'total_amount', cost: 'total_amount', average: 'avg_amount', revenue: 'total_amount', quantity: 'count' },
  purchase_items: { count: 'count', quantity: 'quantity', amount: 'total_amount', cost: 'total_amount', average: 'avg_unit_price' },
  warehouse: { count: 'count', quantity: 'quantity', amount: 'quantity' },
  depreciation: { count: 'count', amount: 'book_value', current_value: 'book_value', cost: 'accumulated_depreciation' },
  disposals: { count: 'count', revenue: 'revenue', amount: 'revenue', average: 'avg_revenue' },
  incidents: { count: 'count' },
  employees: { count: 'count' },
  transfers: { count: 'count' },
}

/** Grouping vocabulary → dimension id (kept only when the module has it). */
export const DIMENSION_TERMS = {
  category: ['category', 'categories', 'by type', 'kind', 'کتگوری', 'کتگوری ها', 'دسته', 'دسته بندی', 'نوعیت', 'صنف', 'ډول', 'ډولونه', 'فئه', 'الفئه', 'تصنیف', 'نوع'],
  subcategory: ['subcategory', 'sub category', 'زیر دسته', 'زیرمجموعه', 'فرعی'],
  department: ['department', 'departments', 'دیپارتمنت', 'بخش', 'اداره', 'شعبه اداری', 'څانګه', 'قسم', 'الاقسام', 'اداره'],
  faculty: ['faculty', 'faculties', 'school', 'پوهنځی', 'دانشکده', 'فاکولته', 'پوهنځي', 'کلیه', 'الکلیات'],
  campus: ['campus', 'campuses', 'branch', 'branches', 'site', 'location', 'کمپس', 'شعبه', 'شعبات', 'محوطه', 'مرکز', 'موقعیت', 'څانګه', 'فرع', 'الفروع', 'الحرم'],
  building: ['building', 'buildings', 'block', 'ساختمان', 'بلاک', 'تعمیر ساختمان', 'ودانی', 'مبنی', 'المبانی'],
  room: ['room', 'rooms', 'اتاق', 'صنف درسی', 'اطاق', 'خونه', 'غرفه', 'الغرف'],
  supplier: ['supplier', 'suppliers', 'vendor', 'vendors', 'تامین کننده', 'تهیه کننده', 'فروشنده', 'عرضه کننده', 'عرضه کوونکی', 'مورد', 'الموردین', 'موردین'],
  warehouse: ['warehouse', 'warehouses', 'store', 'انبار', 'گدام', 'ګدام', 'مستودع', 'المستودعات', 'مخزن'],
  employee: ['employee', 'employees', 'person', 'staff member', 'کارمند', 'کارمندان', 'شخص', 'کارکوونکی', 'موظف', 'الموظفین'],
  technician: ['technician', 'technicians', 'engineer', 'تخنیکر', 'تکنسین', 'مهندس', 'تخنیکي', 'فني', 'الفنیین'],
  status: ['status', 'state', 'وضعیت', 'حالت', 'وضع', 'حاله', 'الحاله'],
  condition: ['condition', 'حالت فزیکی', 'کیفیت', 'وضعیت فزیکی', 'حالت جسمي', 'الحاله الفنیه'],
  brand: ['brand', 'brands', 'make', 'برند', 'مارک', 'نښان', 'الماركه', 'ماركه'],
  model: ['model', 'models', 'مودل', 'ماډل', 'موديل'],
  supplier_name: [],
  method: ['method', 'روش', 'طریقه', 'میتود', 'الطریقه'],
  type: ['type', 'types', 'نوع', 'نوعیت', 'ډول', 'النوع'],
  item: ['item', 'items', 'product', 'products', 'قلم', 'اقلام', 'محصول', 'محصولات', 'جنس', 'توکی', 'صنف', 'المنتجات', 'الاصناف'],
  asset: ['asset name', 'per asset', 'each asset', 'نام دارایی', 'هر دارایی', 'د شتمنۍ نوم', 'اسم الاصل'],
  period: ['period', 'دوره', 'مقطع', 'موده', 'الفتره'],
  from_department: ['from department', 'source department', 'از دیپارتمنت', 'مبدا'],
  to_department: ['to department', 'destination', 'به دیپارتمنت', 'مقصد'],
  employment_type: ['employment type', 'contract type', 'نوع استخدام', 'نوع قرارداد', 'نوع التوظیف'],
  position: ['position', 'job title', 'role', 'بست', 'وظیفه', 'عنوان شغلی', 'دنده', 'الوظیفه'],
  day: ['day', 'daily', 'per day', 'each day', 'روز', 'روزانه', 'هر روز', 'ورځ', 'ورځنی', 'یوم', 'یومی', 'کل یوم'],
  week: ['week', 'weekly', 'per week', 'هفته', 'هفتگی', 'هر هفته', 'اونۍ', 'اونیز', 'اسبوع', 'اسبوعی'],
  month: ['month', 'monthly', 'per month', 'each month', 'by month', 'ماه', 'ماهانه', 'ماهوار', 'هر ماه', 'میاشت', 'میاشتنی', 'شهر', 'شهری', 'کل شهر'],
  quarter: ['quarter', 'quarterly', 'ربع', 'سه ماهه', 'ربعوار', 'ربع سنوی'],
  year: ['year', 'yearly', 'annual', 'annually', 'per year', 'سال', 'سالانه', 'سالوار', 'هر سال', 'کال', 'کلنی', 'سنه', 'سنوی'],
}

/** Time dimensions are available on every module (they bucket its date field). */
export const TIME_DIMENSIONS = ['day', 'week', 'month', 'quarter', 'year']

/** Period vocabulary → date preset id. Longer phrases are matched first. */
export const PERIOD_TERMS = {
  today: ['today', 'امروز', 'امروزه', 'نن', 'نن ورځ', 'الیوم', 'هذا الیوم'],
  yesterday: ['yesterday', 'دیروز', 'روز گذشته', 'پرون', 'امس', 'البارحه'],
  this_week: ['this week', 'current week', 'این هفته', 'هفته جاری', 'دا اونۍ', 'هذا الاسبوع'],
  last_week: ['last week', 'previous week', 'past week', 'هفته گذشته', 'هفته قبل', 'هفته پیش', 'تیره اونۍ', 'الاسبوع الماضی', 'الاسبوع السابق'],
  this_month: ['this month', 'current month', 'این ماه', 'ماه جاری', 'ماه روان', 'دی میاشت', 'دا میاشت', 'هذا الشهر', 'الشهر الحالی'],
  last_month: ['last month', 'previous month', 'past month', 'ماه گذشته', 'ماه قبل', 'ماه پیش', 'تیره میاشت', 'الشهر الماضی', 'الشهر السابق'],
  this_quarter: ['this quarter', 'current quarter', 'این ربع', 'سه ماه جاری', 'دا ربع', 'هذا الربع'],
  this_year: ['this year', 'current year', 'year to date', 'امسال', 'سال جاری', 'این سال', 'سال روان', 'سږکال', 'دا کال', 'هذه السنه', 'هذا العام', 'العام الحالی'],
  last_year: ['last year', 'previous year', 'past year', 'سال گذشته', 'سال قبل', 'پارسال', 'تیر کال', 'السنه الماضیه', 'العام الماضی'],
  last_7_days: ['last 7 days', 'last seven days', 'past week days', '7 روز گذشته', 'هفت روز گذشته', 'وروستی 7 ورځې', 'اخر 7 ایام', 'آخر سبعه ایام'],
  last_30_days: ['last 30 days', 'last thirty days', 'past 30 days', '30 روز گذشته', 'سی روز گذشته', 'وروستي 30 ورځې', 'اخر 30 یوم', 'اخر ثلاثین یوما'],
  last_90_days: ['last 90 days', 'last three months', 'last 3 months', 'past 90 days', '90 روز گذشته', 'سه ماه گذشته', 'سه ماه اخیر', 'وروستي 90 ورځې', 'وروستي درې میاشتې', 'اخر 90 یوم', 'اخر ثلاثه اشهر'],
  last_6_months: ['last 6 months', 'last six months', 'past six months', 'شش ماه گذشته', '6 ماه گذشته', 'شش ماه اخیر', 'وروستي شپږ میاشتې', 'اخر سته اشهر', 'اخر 6 اشهر'],
  last_12_months: ['last 12 months', 'last twelve months', 'trailing year', '12 ماه گذشته', 'دوازده ماه گذشته', 'وروستي 12 میاشتې', 'اخر 12 شهرا', 'اخر اثنی عشر شهرا'],
  next_30_days: ['next 30 days', 'coming 30 days', 'within 30 days', 'in the next month', '30 روز آینده', 'یک ماه آینده', 'طی 30 روز', 'راتلونکي 30 ورځې', 'خلال 30 یوما', 'الثلاثین یوما القادمه'],
  next_90_days: ['next 90 days', 'coming 90 days', 'within 90 days', 'next three months', 'in the next 3 months', '90 روز آینده', 'سه ماه آینده', 'طی 90 روز', 'راتلونکي 90 ورځې', 'خلال 90 یوما', 'الاشهر الثلاثه القادمه'],
  all_time: ['all time', 'ever', 'overall', 'no date filter', 'همه زمان ها', 'کل دوره', 'از ابتدا', 'ټول وخت', 'کل الاوقات', 'منذ البدایه'],
}

/** Question shape hints. */
export const INTENT_TERMS = {
  top: ['top', 'best', 'highest', 'most', 'largest', 'maximum', 'leading', 'biggest',
    'بهترین', 'بیشترین', 'بالاترین', 'زیادترین', 'عمده ترین', 'برترین', 'بزرگترین',
    'غوره', 'تر ټولو ډیر', 'ډیر',
    'اعلی', 'اکثر', 'افضل', 'الاکثر', 'الاعلی'],
  bottom: ['lowest', 'least', 'fewest', 'minimum', 'worst', 'low stock', 'smallest',
    'کمترین', 'پایین ترین', 'کم ترین', 'کمبود', 'ذخیره کم',
    'تر ټولو لږ', 'لږ',
    'ادنی', 'اقل', 'الاقل', 'الادنی'],
  compare: ['compare', 'comparison', 'versus', ' vs ', 'against each',
    'مقایسه', 'مقابله', 'در برابر',
    'پرتله', 'پرتلنه',
    'مقارنه', 'قارن', 'مقابل'],
  trend: ['trend', 'over time', 'growth', 'evolution', 'by month', 'monthly trend',
    'روند', 'تغییرات', 'رشد', 'در طول زمان',
    'بهیر', 'وده',
    'اتجاه', 'التطور', 'النمو', 'عبر الزمن'],
  list: ['list', 'show all', 'show me all', 'give me all', 'details', 'detailed', 'every',
    'لیست', 'فهرست', 'همه', 'تمام', 'جزئیات', 'تفصیل', 'نشان بده همه',
    'لړلیک', 'ټول', 'تفصیلات',
    'قائمه', 'قائمة', 'کل', 'جمیع', 'تفاصیل'],
  expiring: ['expire', 'expiring', 'expiry', 'expired', 'warranty end', 'about to expire',
    'منقضی', 'انقضا', 'انقضاء', 'ختم وارنتی', 'تاریخ انقضا', 'در حال انقضا',
    'پای ته رسیدو', 'د ضمانت پای',
    'انتهاء', 'منتهی', 'تنتهی', 'انتهاء الضمان'],
  overdue: ['overdue', 'late', 'not returned', 'past due',
    'معوق', 'تاخیر', 'برنگشته', 'دیر شده',
    'ځنډ', 'نه راستنیدلی',
    'متاخر', 'متاخره', 'غیر معاد'],
}

/**
 * Enum filter vocabulary: term → { filter, value }. Only applied when the
 * resolved module actually declares that filter and allows that value.
 */
export const VALUE_TERMS = [
  { filter: 'status', value: 'available', terms: ['available', 'free', 'in stock', 'unassigned', 'موجود', 'آزاد', 'در دسترس', 'قابل استفاده', 'شته', 'متاح', 'متوفر'] },
  { filter: 'status', value: 'assigned', terms: ['assigned', 'in use', 'issued', 'تخصیص یافته', 'واگذار شده', 'در حال استفاده', 'ورکړل شوی', 'مخصص', 'مستخدم'] },
  { filter: 'status', value: 'under_maintenance', terms: ['under maintenance', 'in repair', 'being repaired', 'تحت ترمیم', 'در حال تعمیر', 'زیر ترمیم', 'تحت الصیانه', 'قید الاصلاح'] },
  { filter: 'status', value: 'damaged', terms: ['damaged', 'broken', 'faulty', 'خراب', 'آسیب دیده', 'معیوب', 'ماتیدلی', 'تالف', 'معطل'] },
  { filter: 'status', value: 'lost', terms: ['lost', 'missing', 'گم شده', 'مفقود', 'ناپدید', 'ورک', 'مفقود', 'ضائع'] },
  { filter: 'status', value: 'disposed', terms: ['disposed', 'written off', 'دفع شده', 'اسقاط شده', 'له منځه تللی', 'متلف'] },
  { filter: 'status', value: 'active', terms: ['active', 'ongoing', 'فعال', 'جاری', 'روان', 'فعاله', 'نشط'] },
  { filter: 'status', value: 'completed', terms: ['completed', 'finished', 'done', 'closed', 'تکمیل شده', 'مکمل', 'خاتمه یافته', 'بشپړ شوی', 'مکتمل', 'منتهی'] },
  { filter: 'status', value: 'pending', terms: ['pending', 'waiting', 'awaiting approval', 'در انتظار', 'معطل', 'منتظر تایید', 'په تمه', 'معلق', 'قید الانتظار'] },
  { filter: 'status', value: 'approved', terms: ['approved', 'تایید شده', 'منظور شده', 'تصویب شده', 'تصویب شوی', 'موافق علیه', 'معتمد'] },
  { filter: 'status', value: 'rejected', terms: ['rejected', 'declined', 'رد شده', 'رد گردیده', 'رد شوی', 'مرفوض'] },
  { filter: 'status', value: 'open', terms: ['open incidents', 'unresolved', 'باز', 'حل نشده', 'خلاص', 'مفتوح', 'غیر محلول'] },
  { filter: 'type', value: 'preventive', terms: ['preventive', 'planned maintenance', 'وقایوی', 'پیشگیرانه', 'مخنیوونکی', 'وقائیه'] },
  { filter: 'type', value: 'corrective', terms: ['corrective', 'اصلاحی', 'ترمیمی', 'سمونیز', 'تصحیحیه'] },
  { filter: 'type', value: 'emergency', terms: ['emergency', 'urgent', 'عاجل', 'اضطراری', 'بیړنی', 'طارئ'] },
  { filter: 'condition', value: 'new', terms: ['brand new', 'new condition', 'نو', 'جدید', 'نوی', 'جدیده'] },
  { filter: 'condition', value: 'poor', terms: ['poor condition', 'bad condition', 'حالت بد', 'خراب حالت', 'بد حالت', 'حاله سیئه'] },
]

/**
 * Suggested questions shown under the Ask box. They are translation KEYS, not
 * text, so the suggestions themselves switch language with the interface.
 */
export const SUGGESTION_KEYS = [
  'reports.suggestions.assetsByCategory',
  'reports.suggestions.maintenanceCostThisYear',
  'reports.suggestions.topSuppliers',
  'reports.suggestions.warrantyExpiring',
  'reports.suggestions.assignmentsByDepartment',
  'reports.suggestions.purchasesByMonth',
  'reports.suggestions.damagedAssets',
  'reports.suggestions.stockMovements',
]

export default MODULE_TERMS
