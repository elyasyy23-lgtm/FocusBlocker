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

  // ---------------------------------------------------------- v1.3.0: help
  Help: 'راهنما',
  'How to use Tavakkol': 'چطور از توکل استفاده کنیم',
  'Welcome to Tavakkol. Here is how to protect yourself:':
    'به توکل خوش آمدید. راه محافظت از خودتان این است:',
  'Set Keywords & Domains': 'کلمه‌ها و سایت‌ها را تنظیم کنید',
  'Add the words and websites you want to block in the main screen and tap Save.':
    'کلمه‌ها و سایت‌هایی را که می‌خواهید مسدود شوند در صفحهٔ اصلی وارد کنید و «ذخیره» را بزنید.',
  'Enable Accessibility': 'دسترسی‌پذیری را روشن کنید',
  "Tap 'Open Accessibility Settings' and turn on the 'Tavakkol guard' service.":
    'روی «باز کردن تنظیمات دسترسی‌پذیری» بزنید و سرویس «محافظ توکل» را روشن کنید.',
  'Activate Device Admin': 'مدیر دستگاه را فعال کنید',
  "Tap 'Activate Device Admin'. This prevents the app from being uninstalled easily.":
    'روی «فعال‌سازی مدیر دستگاه» بزنید. این کار جلوی حذف آسان برنامه را می‌گیرد.',
  'Strict Lock & Partner PIN': 'قفل سخت‌گیرانه و رمز همراه',
  'Open Settings and set a Partner PIN. Give this PIN to your spouse or a trusted friend. The app will ask for it every time it opens; Settings and the Protection switch never ask for it.':
    'به تنظیمات بروید و رمز همراه را تعیین کنید. این رمز را به همسر یا دوست مورد اعتمادتان بدهید. برنامه هر بار که باز می‌شود آن را می‌پرسد؛ تنظیمات و کلید محافظت هرگز آن را نمی‌پرسند.',
  'Excluded Apps': 'برنامه‌های مستثنی',
  'Go to Settings to select apps (like Telegram or SMS) that should NOT be blocked.':
    'به تنظیمات بروید و برنامه‌هایی (مثل تلگرام یا پیامک) را که نباید مسدود شوند انتخاب کنید.',
  "If you wish to support the development of this app, you can use the 'Donate' button in Settings.":
    'اگر دوست دارید از توسعهٔ این برنامه حمایت کنید، می‌توانید از دکمهٔ «حمایت مالی» در تنظیمات استفاده کنید.',
  'International supporters can use the Crypto Wallet option. Thank you!':
    'حامیان خارج از کشور می‌توانند از گزینهٔ کیف پول ارز دیجیتال استفاده کنند. سپاسگزاریم!',
  'Open Settings': 'باز کردن تنظیمات',

  // -------------------------------------------------------- v1.3.0: donate
  'Support Us': 'حمایت از ما',
  'Five short steps — from the first keyword to the partner PIN.':
    'پنج گام کوتاه — از نخستین کلمه تا رمز همراه.',
  'Tavakkol is free and has no ads. If it helps you, you can support it.':
    'توکل رایگان است و تبلیغ ندارد. اگر به کارتان می‌آید، می‌توانید از آن حمایت کنید.',
  'International supporters can use the Crypto Wallet option.':
    'حامیان خارج از کشور می‌توانند از گزینهٔ کیف پول ارز دیجیتال استفاده کنند.',
  Donate: 'حمایت مالی',
  'Thank you for supporting Tavakkol. Every donation keeps it free.':
    'از حمایت شما از توکل سپاسگزاریم. هر کمک، این برنامه را رایگان نگه می‌دارد.',
  'Copy wallet address': 'کپی کردن آدرس کیف پول',
  Copied: 'کپی شد',

  // ------------------------------------------- v1.3.1: strict lock / PIN
  'Tavakkol is locked': 'برنامه توکل قفل است',
  'Enter the Partner PIN to continue.': 'برای ادامه، رمز همراه را وارد کنید.',
  Unlock: 'باز کردن',
  'Wrong PIN. Try again.': 'رمز نادرست است. دوباره تلاش کنید.',
  'Ask your partner for the PIN.': 'رمز را از همراه خود بپرسید.',
  'Set the Partner PIN': 'تعیین رمز همراه',
  'Repeat the PIN': 'تکرار رمز',
  'Enter the Partner PIN': 'رمز همراه را وارد کنید',
  'Only this PIN can turn Protection off.': 'فقط با این رمز می‌توان محافظت را خاموش کرد.',
  'Enter the same PIN again.': 'همان رمز را دوباره وارد کنید.',
  'Choose a 4 to 8 digit PIN and give it to your partner. Without it Protection cannot be turned off and this app cannot be opened.':
    'یک رمز ۴ تا ۸ رقمی انتخاب کنید و به همراه خود بدهید. بدون آن نه می‌توان محافظت را خاموش کرد و نه این برنامه باز می‌شود.',
  'PINs do not match. Start again.': 'رمزها یکسان نیستند. از نو شروع کنید.',

  // ------------------------- v1.3.2: lock title, collapsed list, donations
  'Show more ({{count}})': 'نمایش بیشتر ({{count}})',
  'Show less': 'نمایش کمتر',
  'Tavakkol is completely free and has no ads. If you are happy with this app, you can share in this good deed.':
    'برنامه توکل کاملاً رایگان است و تبلیغ ندارد. اگر از این برنامه راضی هستید، می‌توانید در این امر خیر شریک شوید.',
  More: 'بیشتر',
  'Support from inside Iran': 'حمایت از حامیان داخل ایران',
  'Support from outside Iran': 'حمایت از حامیان خارج از کشور',
  'Open the payment page': 'باز کردن صفحه پرداخت',
  'The domestic payment link is not set yet.': 'لینک پرداخت داخلی هنوز تنظیم نشده است.',
  'The app asks for this PIN when it opens — never inside the app. While Protection is on, the Device-admin page is kept closed too.':
    'برنامه هنگام باز شدن این رمز را می‌پرسد — نه در داخل برنامه. تا وقتی محافظت روشن است، صفحهٔ «مدیران دستگاه» هم بسته می‌ماند.',
  'Partner PIN saved. Protection is now locked.':
    'رمز همراه ذخیره شد. محافظت اکنون قفل است.',
  'Could not save the PIN.': 'ذخیرهٔ رمز انجام نشد.',
  'Protection is off.': 'محافظت خاموش شد.',
  Continue: 'ادامه',
  'Skip PIN': 'بدون رمز',
  Cancel: 'انصراف',
  'Partner PIN': 'رمز همراه',
  'The app asks for this PIN when it opens. Settings and the Protection switch never ask for it.':
    'برنامه هنگام باز شدن این رمز را می‌پرسد. تنظیمات و کلید محافظت هرگز آن را نمی‌پرسند.',
  'The app lock is on.': 'قفل برنامه روشن است.',
  'No PIN yet — the app opens without asking.':
    'هنوز رمزی تعیین نشده — برنامه بدون پرسیدن باز می‌شود.',
  'Change PIN': 'تغییر رمز',
  'Remove PIN': 'حذف رمز',
  'Set Partner PIN': 'تعیین رمز همراه',
  'Remove Partner PIN': 'حذف رمز همراه',
  'Enter the current PIN': 'رمز فعلی را وارد کنید',
  'Enter the current PIN to remove the app lock.':
    'برای برداشتن قفل برنامه، رمز فعلی را وارد کنید.',
  'The current PIN is needed to choose a new one.':
    'برای انتخاب رمز تازه، رمز فعلی لازم است.',
  'Choose a new PIN': 'رمز تازه را انتخاب کنید',
  '4 to 8 digits. This PIN is asked for when the app opens.':
    '۴ تا ۸ رقم. این رمز هنگام باز شدن برنامه پرسیده می‌شود.',
  'Partner PIN saved. The app now asks for it when it opens.':
    'رمز همراه ذخیره شد. برنامه از این پس هنگام باز شدن آن را می‌پرسد.',
  'PIN removed. The app no longer asks for it.':
    'رمز حذف شد. برنامه دیگر آن را نمی‌پرسد.',
  Remove: 'حذف',
  Save: 'ذخیره',
  'Could not copy the wallet address.': 'کپی کردن آدرس کیف پول ممکن نشد.',
  'The donation wallet address is not set yet.': 'آدرس کیف پول برای حمایت هنوز تنظیم نشده است.',
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
