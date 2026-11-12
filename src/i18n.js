/**
 * Tiny dependency-free translator for Tavakkol (v1.2.0).
 *
 * The English UI text IS the key: `t('Protection')` returns
 * 'محافظت' when the language is Persian and the English string otherwise.
 * A missing key therefore never breaks the UI — it just stays English.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fa', label: 'فارسی' },
];

const FA = {
  // ---------------------------------------------------------------- branding
  Tavakkol: 'توکل',
  'توکل': 'توکل',
  'A guard for your own phone. It watches text as it changes on screen — a blocked keyword or domain in a search bar, address bar or chat closes the app immediately.':
    'محافظی برای گوشی خودتان. متنِ روی صفحه را همان لحظه که تغییر می‌کند بررسی می‌کند؛ اگر کلمه یا سایت مسدودی در کادر جستجو، نوار آدرس یا چت ظاهر شود، برنامه فوراً بسته می‌شود.',
  'This app is completely free. Please remember us in your prayers.':
    'این برنامه کاملاً رایگان است. ما را از دعای خیرتان فراموش نکنید.',

  'Personal guard': 'محافظ شخصی',
  '{{n}}. {{title}}': '{{n}}. {{title}}',
  'Settings → Accessibility → Installed apps': 'تنظیمات ← دسترسی‌پذیری ← برنامه‌های نصب‌شده',
  'Open Autostart settings ({{manufacturer}})': 'باز کردن تنظیمات اجرای خودکار ({{manufacturer}})',
  '{{seconds}}s ago': '{{seconds}} ثانیه پیش',
  '{{minutes}}min ago': '{{minutes}} دقیقه پیش',
  never: 'هرگز',
  'Battery optimization': 'بهینه‌سازی باتری',
  'checking…': 'در حال بررسی…',
  'Could not save the excluded apps.': 'ذخیرهٔ برنامه‌های مستثنی ممکن نشد.',

  // ------------------------------------------------------------- native warn
  'Native build required': 'نیاز به نسخهٔ نصب‌شدنی',
  'Expo Go cannot run accessibility services. Build the APK (eas build -p android --profile preview) and install it — every control below works there.':
    'Expo Go نمی‌تواند سرویس دسترسی‌پذیری را اجرا کند. فایل APK را نصب کنید؛ همهٔ گزینه‌های زیر در آن کار می‌کنند.',

  // -------------------------------------------------------------------- hero
  Protection: 'محافظت',
  Active: 'فعال',
  'Not active yet': 'هنوز فعال نیست',
  'Blocker paused': 'محافظ متوقف شده',
  'Accessibility service is running': 'سرویس دسترسی‌پذیری روشن است',
  'Service is off — enable it below': 'سرویس خاموش است — پایین‌تر روشن کنید',
  '{{keywords}} keyword(s) + {{domains}} domain(s) watched': '{{keywords}} کلمه و {{domains}} سایت زیر نظر',
  '{{count}} block(s) so far': '{{count}} بار مسدودسازی تا اینجا',

  // --------------------------------------------------------------- sections
  'Blocked keywords': 'کلمه‌های مسدود',
  'Any text that changes on screen is checked — search bars, the browser address bar and chat messages (Telegram, Rubika). Separate keywords with a comma. Matching is whole-word only, so a short word never fires inside a longer one.':
    'هر متنی که روی صفحه تغییر کند بررسی می‌شود: کادر جستجو، نوار آدرس مرورگر و پیام‌های چت (تلگرام، روبیکا). کلمه‌ها را با ویرگول جدا کنید. تطبیق فقط روی کلمهٔ کامل انجام می‌شود، پس یک کلمهٔ کوتاه داخل یک کلمهٔ بلندتر فعال نمی‌شود.',
  'Save block list': 'ذخیرهٔ فهرست کلمه‌ها',
  'No keywords yet — nothing will be blocked.': 'هنوز کلمه‌ای نیست — چیزی مسدود نمی‌شود.',
  'Blocked domains': 'سایت‌های مسدود',
  'The guard reads the address bar of Chrome and other browsers. http://, https://, www. and paths are removed automatically — just type the domain.':
    'محافظ نوار آدرس کروم و بقیهٔ مرورگرها را می‌خواند. http:// و https:// و www. و مسیرها خودکار حذف می‌شوند؛ فقط دامنه را بنویسید.',
  'Save domain list': 'ذخیرهٔ فهرست سایت‌ها',
  'No domains yet — the browser stays open.': 'هنوز سایتی نیست — مرورگر باز می‌ماند.',
  'Accessibility service': 'سرویس دسترسی‌پذیری',
  'This is what lets the app read the screen and press Back. Android shows a warning — that warning is normal for any accessibility app.':
    'این همان چیزی است که به برنامه اجازه می‌دهد صفحه را بخواند و دکمهٔ بازگشت را بزند. اندروید یک هشدار نشان می‌دهد؛ این هشدار برای همهٔ برنامه‌های دسترسی‌پذیری طبیعی است.',
  'Service status': 'وضعیت سرویس',
  Settings: 'تنظیمات',
  Enabled: 'روشن',
  Disabled: 'خاموش',
  'Open Accessibility settings': 'باز کردن تنظیمات دسترسی‌پذیری',
  'Device admin (anti-uninstall)': 'مدیر دستگاه (ضد حذف)',
  'While device admin is active, Android refuses to uninstall Tavakkol. Deactivate it in Settings → Security → Device admin apps if you ever want the app gone.':
    'تا وقتی مدیر دستگاه فعال است، اندروید اجازهٔ حذف توکل را نمی‌دهد. اگر می‌خواهید برنامه حذف شود، آن را در تنظیمات ← امنیت ← برنامه‌های مدیر دستگاه غیرفعال کنید.',
  'Device admin': 'مدیر دستگاه',
  'Uses the force-lock policy': 'از سیاست قفل فوری استفاده می‌کند',
  Inactive: 'غیرفعال',
  'Panic lock screen': 'قفل فوری صفحه',
  'Activate device admin': 'فعال کردن مدیر دستگاه',
  Stats: 'آمار',
  'Stored on this device only — nothing is uploaded.': 'فقط روی همین گوشی ذخیره می‌شود؛ چیزی به اینترنت فرستاده نمی‌شود.',
  Blocks: 'مسدودسازی',
  Keywords: 'کلمه‌ها',
  Domains: 'سایت‌ها',
  'Last block': 'آخرین مسدودسازی',
  'nothing yet': 'هنوز چیزی نیست',
  'Reset counter': 'صفر کردن شمارنده',
  'Keep-alive': 'زنده‌نگه‌داشتن',
  'Android — and MIUI/HyperOS especially — kills background apps. Three independent restarters bring the guard back by themselves: a restartable foreground watchdog, a 15-minute alarm and a 15-minute job, plus a boot receiver.':
    'اندروید — و به‌ویژه MIUI/HyperOS — برنامه‌های پس‌زمینه را می‌کشد. سه راه مستقل محافظ را خودشان برمی‌گردانند: نگهبان پیش‌زمینهٔ قابل‌راه‌اندازی، زنگ ۱۵ دقیقه‌ای و کار زمان‌بندی‌شدهٔ ۱۵ دقیقه‌ای، به‌همراه گیرندهٔ روشن شدن گوشی.',
  'Watchdog service': 'سرویس نگهبان',
  'heartbeat never': 'ضربان: هرگز',
  'heartbeat {{age}}': 'ضربان: {{age}}',
  Up: 'روشن',
  Down: 'خاموش',
  'Start keep-alive now': 'همین حالا زنده‌نگه‌داشتن را روشن کن',
  'Open Autostart settings': 'باز کردن تنظیمات اجرای خودکار',
  'One-time setup on Redmi / POCO / Xiaomi: 1) Autostart → Tavakkol ON, 2) Battery saver → No restrictions, 3) in Recents, pull Tavakkol down to lock it. Without Autostart even a foreground service gets killed within hours.':
    'تنظیم یک‌بارهٔ گوشی‌های ردمی / پوکو / شیائومی: ۱) اجرای خودکار ← توکل روشن، ۲) صرفه‌جویی باتری ← بدون محدودیت، ۳) در برنامه‌های اخیر، توکل را به پایین بکشید تا قفل شود. بدون اجرای خودکار حتی سرویس پیش‌زمینه هم بعد از چند ساعت کشته می‌شود.',
  'Debug Log': 'گزارش خطا',
  'Everything the background guard does — service starts and stops, foreground-service state, watchdog wake-ups, keyword/domain hits and blocks — recorded on this device, never uploaded. Survives crashes and restarts.':
    'همهٔ کارهای محافظ در پس‌زمینه — روشن و خاموش شدن سرویس، وضعیت سرویس پیش‌زمینه، بیدار شدن نگهبان، برخورد با کلمه یا سایت و مسدودسازی — روی همین گوشی ثبت می‌شود و هرگز ارسال نمی‌شود. بعد از بسته شدن و راه‌اندازی دوباره باقی می‌ماند.',
  'Show Logs': 'نمایش گزارش‌ها',
  Close: 'بستن',
  Refresh: 'به‌روزرسانی',
  'Clear log': 'پاک کردن گزارش',
  'Last 100 events · newest first': '۱۰۰ رویداد آخر · جدیدترین اول',
  'Close debug log': 'بستن گزارش خطا',
  'No events recorded yet. The log fills as soon as the guard runs — tap Refresh after using the phone, or Clear to start over.':
    'هنوز رویدادی ثبت نشده است. گزارش به‌محض روشن شدن محافظ پر می‌شود؛ بعد از استفاده از گوشی «به‌روزرسانی» را بزنید یا با «پاک کردن» از نو شروع کنید.',
  'Exclude from battery optimization': 'معاف کردن از بهینه‌سازی باتری',
  'Works fully offline. Any text that changes on screen is checked — search bars, address bars and chat messages. While the guard is running it keeps a small persistent notification: if that notification disappears, the guard was stopped. The watchdog, the 15-minute alarm, the 15-minute job and the boot receiver restart it on their own — and if the guard stays down for more than three minutes you get an alert instead of silently losing protection.':
    'کاملاً آفلاین کار می‌کند. هر متنی که روی صفحه تغییر کند بررسی می‌شود: کادر جستجو، نوار آدرس و پیام‌های چت. تا وقتی محافظ روشن است یک اعلان کوچک و همیشگی دارد؛ اگر آن اعلان از بین رفت یعنی محافظ متوقف شده است. نگهبان، زنگ ۱۵ دقیقه‌ای، کار ۱۵ دقیقه‌ای و گیرندهٔ روشن شدن گوشی خودشان دوباره راه‌اندازی می‌کنند و اگر محافظ بیش از سه دقیقه خاموش بماند هشدار می‌گیرید، نه سکوت.',

  // ------------------------------------------------------------ health text
  'Service {{state}}': 'سرویس {{state}}',
  running: 'در حال اجرا',
  'NOT running': 'اجرا نمی‌شود',
  'foreground notification active': 'اعلان پیش‌زمینه فعال است',
  'NO foreground notification': 'اعلان پیش‌زمینه ندارد',
  'watchdog {{state}} ({{age}})': 'نگهبان {{state}} ({{age}})',
  up: 'بالا',
  DOWN: 'پایین',
  'battery unrestricted': 'باتری بدون محدودیت',
  'battery RESTRICTED — Android may kill the guard': 'باتری محدود — اندروید ممکن است محافظ را بکشد',
  'battery optimization on (kill risk)': 'بهینه‌سازی باتری روشن (خطر کشته شدن)',
  'battery optimization off (safe)': 'بهینه‌سازی باتری خاموش (امن)',
  'Accessibility: {{state}}': 'دسترسی‌پذیری: {{state}}',
  enabled: 'روشن',
  DISABLED: 'خاموش',
  'Guard bound: {{state}}': 'اتصال محافظ: {{state}}',
  yes: 'بله',
  no: 'خیر',
  'Foreground service: {{state}}': 'سرویس پیش‌زمینه: {{state}}',
  'Watchdog: {{state}}': 'نگهبان: {{state}}',

  // --------------------------------------------------------------- messages
  'Could not read the native configuration.': 'خواندن تنظیمات داخلی ممکن نشد.',
  'Block list cleared — nothing is blocked right now.': 'فهرست پاک شد — در این لحظه چیزی مسدود نمی‌شود.',
  'Saved {{count}} keyword(s).': '{{count}} کلمه ذخیره شد.',
  'Saving the block list failed.': 'ذخیرهٔ فهرست کلمه‌ها انجام نشد.',
  'Domain list cleared — no website is blocked.': 'فهرست سایت‌ها پاک شد — هیچ سایتی مسدود نیست.',
  'Saved {{count}} domain(s).': '{{count}} سایت ذخیره شد.',
  'Saving the domain list failed.': 'ذخیرهٔ فهرست سایت‌ها انجام نشد.',
  'Could not change the blocker state.': 'تغییر وضعیت محافظ ممکن نشد.',
  'Could not open Accessibility settings.': 'باز کردن تنظیمات دسترسی‌پذیری ممکن نشد.',
  'Find “Tavakkol guard (keywords + domains)” in the list and switch it on.':
    'در فهرست دنبال «محافظ توکل» بگردید و آن را روشن کنید.',
  'Confirm the system dialog to keep Tavakkol installed.':
    'پنجرهٔ سیستم را برای جلوگیری از حذف توکل تأیید کنید.',
  'Could not open the device admin dialog.': 'باز کردن پنجرهٔ مدیر دستگاه ممکن نشد.',
  'Locking the screen failed.': 'قفل کردن صفحه انجام نشد.',
  'Block counter reset.': 'شمارندهٔ مسدودسازی صفر شد.',
  'Could not reset the counter.': 'صفر کردن شمارنده ممکن نشد.',
  'Could not read the debug log.': 'خواندن گزارش ممکن نشد.',
  'Could not clear the log.': 'پاک کردن گزارش ممکن نشد.',
  'Confirm the system dialog so Android stops killing the guard.':
    'پنجرهٔ سیستم را تأیید کنید تا اندروید محافظ را نکشد.',
  'Could not open the battery dialog.': 'باز کردن پنجرهٔ باتری ممکن نشد.',
  'Keep-alive armed: watchdog started, 15-minute alarm and persisted job scheduled.':
    'زنده‌نگه‌داشتن فعال شد: نگهبان روشن شد و زنگ و کار زمان‌بندی‌شدهٔ ۱۵ دقیقه‌ای تنظیم شد.',
  'Could not start the keep-alive.': 'روشن کردن زنده‌نگه‌داشتن ممکن نشد.',
  'Switch Autostart ON for Tavakkol on this screen, then come back.':
    'در این صفحه اجرای خودکار را برای توکل روشن کنید و برگردید.',
  'Find “Autostart” (or “Battery usage / Allow background activity”) on this screen and allow Tavakkol.':
    'در این صفحه «اجرای خودکار» (یا «مصرف باتری / اجازهٔ فعالیت پس‌زمینه») را پیدا کنید و به توکل اجازه دهید.',
  'Could not open the autostart screen.': 'باز کردن صفحهٔ اجرای خودکار ممکن نشد.',

  // --------------------------------------------------------------- settings
  'Gear icon': 'آیکن تنظیمات',
  Language: 'زبان',
  'Choose the language of the app.': 'زبان برنامه را انتخاب کنید.',
  'Excluded Apps': 'برنامه‌های مستثنی',
  'Checked apps are never inspected — no keyword or domain block inside them.':
    'برنامه‌های تیک‌خورده بررسی نمی‌شوند؛ هیچ کلمه یا سایتی داخل آن‌ها مسدود نمی‌شود.',
  'Search apps': 'جستجوی برنامه…',
  '{{count}} selected': '{{count}} انتخاب شده',
  'Clear selection': 'پاک کردن انتخاب‌ها',
  'Loading apps…': 'در حال خواندن برنامه‌ها…',
  'No app matches this search.': 'هیچ برنامه‌ای با این جستجو پیدا نشد.',
  'Excluded apps are saved instantly.': 'برنامه‌های مستثنی همان لحظه ذخیره می‌شوند.',
  'Share App': 'اشتراک‌گذاری برنامه',
  'Contact Developer': 'ارتباط با توسعه‌دهنده',
  Support: 'پشتیبانی',
  'If you encounter any problems, please contact the developer.':
    'در صورت بروز مشکل با توسعه‌دهنده تماس بگیرید.',
  'If you encounter a problem, please contact the developer.':
    'در صورت بروز مشکل با توسعه‌دهنده تماس بگیرید.',
  'Version {{version}}': 'نسخهٔ {{version}}',
  Back: 'بازگشت',
  'Could not open the link.': 'باز کردن لینک ممکن نشد.',
  'Could not open the share sheet.': 'باز کردن پنجرهٔ اشتراک‌گذاری ممکن نشد.',
  'Tavakkol — a free guard for your phone. Blocked words and sites close themselves while you type.':
    'توکل — محافظ رایگان گوشی. کلمه‌ها و سایت‌های مسدود همان لحظه که تایپ می‌کنید بسته می‌شوند.',
  'Could not load the app list.': 'خواندن فهرست برنامه‌ها ممکن نشد.',
};

const DICT = { fa: FA };

/** Replaces every {{name}} placeholder in [template] with values[name]. */
export function format(template, values) {
  if (!values) return template;
  return String(template).replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Returns a translator bound to [lang]. */
export function createTranslator(lang) {
  const table = DICT[lang] || null;
  return function translate(key, values) {
    const text = (table && table[key]) || key;
    return format(text, values);
  };
}

/** Number of translated strings — used by the verification script. */
export const TRANSLATED_COUNT = Object.keys(FA).length;
