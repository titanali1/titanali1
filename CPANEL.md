# راهنمای کامل راه‌اندازی و استفاده روی هاست سی‌پنل (cPanel) — تیتانلی

مخزن: `titanali1/titanali1` · شاخهٔ کاری: `arena/874bf68b-titanali1`
بستهٔ آماده: `titanali-cpanel.zip` (۱۵ فایل، ≈۱۱۰ کیلوبایت) ← [دانلود مستقیم](https://raw.githubusercontent.com/titanali1/titanali1/latest/titanali-cpanel.zip) · [sha256](https://raw.githubusercontent.com/titanali1/titanali1/latest/titanali-cpanel.zip.sha256)

> این راهنما بر پایهٔ cPanel با پوستهٔ **Jupiter** نوشته شده (در پوستهٔ Retro هم نام آیتم‌ها همان است، فقط جای منو فرق می‌کند).
> من نمی‌توانم روی هاست واقعی شما تست کنم؛ جایی که رفتار بین هاست‌ها فرق می‌کند، صریحاً گفته‌ام «بستگی دارد».

---

## ۰) پنج‌دقیقه‌ای (اگر عجله دارید)

1. cPanel → **File Manager** → دکمهٔ **Settings** (بالا-راست) → تیک **Show hidden files (dotfiles)** → Save. *(بدون این، `.htaccess` را نمی‌بینید و ممکن است آپلود نشود.)*
2. وارد **`public_html`** شوید → **Upload** → `titanali-cpanel.zip` را بکشید و رها کنید.
3. روی فایل زیپ راست‌کلیک → **Extract** → تیک **Overwrite existing files** → **Extract Files**.
4. زیپ را **Delete** کنید (و اگر `deploy/` را کپی کرده‌اید، آن را هم).
5. مرورگر: `https://دامنه‌شما/` → باید سایت را ببینید. بعد `https://دامنه‌شما/api.php?action=health` → باید `{"ok":true,…,"writable":true}` ببینید.
6. روی عنوان **titanali** بالای سایت کلیک کنید → با `admin / titanali1384` وارد شوید → تب **🔄 همگام‌سازی سرور** → فرم «نصب روی سرور» را پر کنید (رمز ۸+ کاراکتر) → **ساخت ادمین سرور و فرستادن محتوا**.
7. cPanel → **SSL/TLS Status** → **Run AutoSSL** (اگر SSL ندارید). تمام.

اگر هر قدم گیر کرد، بخش **۱۵) عیب‌یابی** را خط‌به‌خط بروید.

---

> می‌خواهید همه‌چیز را با یک پاست یا یک کلیک انجام دهید؟ به بخش **۹-الف** بروید (Terminal سی‌پنل یا GitHub Actions).

## ۱) چه چیزی روی هاست می‌نشیند

| فایل | کار | اجباری؟ |
|---|---|---|
| `index.html` | کل سایت: HTML + CSS + JS در یک فایل، RTL فارسی، سوییچ fa⇄en | بله |
| `.htaccess` | gzip، کش، MIME برای `webmanifest`/`svg`، هدرهای امنیتی + CSP، `ErrorDocument`، بستن `titanali-data` و فایل‌های توسعه، exempt کردن `api.php` از کش | بله |
| `404.html` | صفحهٔ خطای تم‌دار | بله |
| `sw.js` | سرویس‌ورکر: آفلاین‌شدن + شبکه‌اول برای صفحه؛ `*.php` را هرگز کش نمی‌کند | بله |
| `site.webmanifest` + `favicon.svg` + `icon-192/512/maskable-512/apple-touch-icon.png` | نصب‌شدن به‌عنوان اپ PWA و آیکون‌ها | بله |
| `og.png` | پیش‌نمایش لینک در تلگرام/واتساپ/اینستا (۱۲۰۰×۶۳۰) | بله |
| `robots.txt`، `sitemap.xml` | ایندکس | بله |
| `api.php` | بک‌اند اختیاری: محتوای مشترک + صندوق پیام‌ها + شمارنده‌ها + ورود ادمین سمت سرور | **اختیاری** |
| `titanali-config.sample.php` | نمونهٔ پیکربندی بک‌اند (به `titanali-config.php` تغییر نام کنید تا فعال شود) | اختیاری |

**هیچ چیز دیگری لازم نیست:** نه Node، نه Composer، نه MySQL، نه build step. `api.php` هم دیتابیس نمی‌خواهد (فایل JSON با قفل `flock`).

ساختار پیشنهادی روی هاست:

```
/home/USER/
├── public_html/              ← فقط همین ۱۵ فایل
── titanali-data/            ← (اختیاری ولی بهتر) دیتای بک‌اند، بیرون از وب
    ├── config.json  content.json  social.json  inbox.json  meta.json
    ├── tokens.json  seen.json  rl.json  log.json  ig.json
    ├── uploads/     ← پیوست‌های گفتگو و عکس‌های آپلودی گالری
    └── backups/     ← ۱۰ نسخهٔ چرخشی قبل از هر import
```

---

## ۲) روش A — آپلود زیپ با File Manager (توصیه‌شده)

1. **File Manager** → **Settings** → ✅ **Show hidden files (dotfiles)**، ✅ **Show system files (web stats)** → Save.
2. وارد `public_html` شوید. اگر سایت قبلی آنجاست: ✅ **Select All** → **Move** به پوشه‌ای مثل `public_html/_old` (یا **Backup Wizard** بگیرید).
3. **Upload** → فایل `titanali-cpanel.zip` (از ریشهٔ مخزن یا از لینک بالا). نوار سبز ۱۰۰٪ که شد، تب را ببندید.
4. روی زیپ راست‌کلیک → **Extract** → در دیالوگ، **Overwrite existing files** را روشن کنید → **Extract Files** → **Done**.
5. زیپ را راست‌کلیک → **Delete**.
6. چک کنید `.htaccess` ردیف شده باشد: اگر نبود، File Manager → **Go to Directory** → آدرس `/public_html/.htaccess` را مستقیم بزنید یا همان فایل را جدا **Upload** کنید (بعضی هاست‌ها هنگام استخراج، فایل‌های نقطه‌دار را رد می‌کنند).
7. بازکردن سایت + `Ctrl+Shift+R` (reload بدون کش).

**نکتهٔ مهم:** اگر زیپ را داخل زیرپوشه استخراج می‌کنید (مثلاً `public_html/site/`)، همه‌چیز کار می‌کند (مسیرها نسبی‌اند) — فقط `ErrorDocument 404 /404.html` در ریشه می‌ماند و در زیرپوشه ممکن است پیدا نشود؛ اشکالی ندارد.

---

## ۳) روش B — FTP / SFTP با FileZilla

1. cPanel → **FTP Accounts** → ساخت کاربر (یا از «FTP + Transfer» استفاده کنید) → **Require FTPS over TLS** را روشن بگذارید.
2. FileZilla: **Host = ftp.دامنه‌شما** (یا IP)، **Port = 21**، TLS فعال، **Login Type = Normal**، کاربر/رمز FTP. برای SFTP پورت **22** و کلید SSH (اگر هاست باز کند).
3. FileZilla → Settings → **Interface/Settings → «Never overwrite» را off** و در **Transfers → File Types** بگذارید **Binary** برای همه (پیش‌فرض auto کافی است).
4. پوشهٔ چپ = `dist/titanali-cpanel/` (یا محتویات زیپ) → پوشهٔ راست = `/public_html` → **Upload**.
5. بعد از اتمام: **View → Force showing hidden files** را بزنید تا مطمئن شوید `.htaccess` رفته است؛ اگر نیست، دستی آپلودش کنید.
6. مجوزها: انتخاب همه → راست‌کلیک → **File permissions** → `644`؛ برای پوشه‌ها `755` (روش سریع در بخش ۸).

---

## ۴) روش C — با Git در cPanel («Git™ Version Control»)

بسیاری از هاست‌های cPanel این را دارند و بهترین راه برای به‌روزرسانی منظم است.

1. cPanel → **Git™ Version Control** → **Add Repository**:
   - Repository Name: `titanali`
   - Clone URL: `https://github.com/titanali1/titanali1.git`
   - Branch: `arena/874bf68b-titanali1` (یا شاخه‌ای که شما نگه می‌دارید)
   - **Repository Path**: `/home/USER/public_html` ⚠ این پوشه را `git clone` می‌کند؛ اگر فایل‌های دیگری داخلش باشد تضاد می‌دهد. اگر مخزن `dist/` را هم دارد، بهتر است مسیر را `/home/USER/titanali-src` بگذارید و با یک «symlink» یا کپی کار کنید.
2. برای مخزن خصوصی: **SSH Access → Manage SSH Keys → Create** → **Public key** را در GitHub → Settings → **Deploy keys** اضافه کنید (تیک *Allow write access* لازم نیست).
3. **Configure** → **Webhook URL**: لینکی که cPanel می‌دهد را در GitHub → repo → **Settings → Webhooks → Add webhook** بگذارید (Content type: `application/json`, Just the `arena/...` branch) → هر `push`، سایت را خودکار به‌روز می‌کند.
4. **دقت:** چون مخزن کد منبع است و نه فقط `public_html`، این روش `deploy/` و `README.md` را هم داخل پوشه می‌آورد. `.htaccess` آن‌ها را رد می‌کند (`RedirectMatch 404 ^/deploy(/|$)`)، ولی اگر وسواس دارید روش A/B را نگه دارید و برای دیپلوی، `dist/titanali-cpanel/` را با `rsync` بفرستید.

---

## ۵) دامنه، `www`، DocumentRoot

- cPanel → **Domains** → دامنه را ببینید: **Document Root** باید `/home/USER/public_html` باشد. برای دامنهٔ دوم: **Create A New Domain** و Document Root را روی `public_html` یا زیرپوشهٔ خودش بگذارید.
- **www**: در همان صفحه، گزینه‌های **www.yoursite.com → redirects to yoursite.com** (یا برعکس) را روشن کنید تا دوباره‌نویسی دوگانه ایجاد نشود. `.htaccess` ما `www` را دست نمی‌زند؛ اگر هاست شما «Force https://… with www» را در **Domains** دارد، همان را انتخاب کنید.
- دامنه را به IP هاست وصل کنید: **A record** برای `@` و `CNAME` برای `www` (یا DNS区的 در cPanel → **Zone Editor**). TTL را روی ۳۰۰ بگذارید تا سریع جابه‌جا شود.
- **canonical و OG** در `index.html` روی `https://titanali1.ir/` قفل شده‌اند. اگر دامنه فرق دارد، این سه را عوض کنید و بسته را بازسازی کنید:
  - `index.html` → `<link rel="canonical">`، `<meta property="og:url">`، `<meta property="og:image">`، `<meta name="twitter:image">`
  - `deploy/make-cpanel.py` → ثابت `SITE`
  - `deploy/files/robots.txt` و `sitemap.xml` (با اجرای اسکریپت دوباره ساخته می‌شوند)

```bash
python3 deploy/make-cpanel.py     # بسته و og.png را دوباره می‌سازد
```

---

## ۶) SSL (HTTPS) — بدون آن PWA و سرویس‌ورکر کار نمی‌کنند

1. cPanel → **SSL/TLS Status** → دامنه را انتخاب کنید → **Run AutoSSL** (Let's Encrypt / cPanel). معمولاً ۱ تا ۵ دقیقه.
2. اگر **Issue** گرفت: دلیل رایج «DNS هنوز به IP قبلی اشاره می‌کند» یا `www` که به این هاست اشاره نمی‌کند است. **Check DNS Records** را بزنید.
3. cPanel → **Domains** → ✅ **Force HTTPS Redirection** (این با `RewriteCond %{HTTPS} !=on` داخل `.htaccess` ما یکی است؛ اگر هاست گزینه را دارد، همان را روشن کنید و بلوک rewrite ما را کامنت کنید تا دو بار redirect نشود).
4. **حلقهٔ redirect (ERR_TOO_MANY_REDIRECTS)**؟ یعنی هاست **از قبل** HTTPS را در لایهٔ LB تمام می‌کند (Cloudflare «Full» یا لودبالانسر). در این حالت بلوک HTTPS را در `.htaccess` کامنت کنید (سه خط زیر `# ---------- الزام HTTPS`).
5. پس از SSL، یک بار سایت را با `Ctrl+Shift+R` باز کنید؛ سرویس‌ورکر فقط روی `https:` ثبت می‌شود.
6. «Mixed content» دیدید؟ یعنی جایی `http://` در محتوای پنل نوشته‌اید (آدرس تصویر/پس‌زمینه) — در پنل به `https://` عوض کنید.

---

## ۷) PHP برای `api.php` (اختیاری‌ها را همین‌جا تنظیم کنید)

**cPanel → Select PHP Version (MultiPHP Manager)** → PHP را روی **۷٫۴ / ۸٫۱ / ۸٫۲ / ۸٫۳** بگذارید (کد ما با ۷٫۰ به بالا نوشته شده؛ روی PHP 8.3 هم بدون تغییر کار می‌کند).

**MultiPHP INI Editor → «Editor mode»** برای دامنه:

| کلید | مقدار پیشنهادی | چرا |
|---|---|---|
| `post_max_size` | `12M` | پیوست گفتگو به‌صورت base64 در بدنهٔ JSON می‌آید (~۳۳٪ باد می‌کند؛ سقف فایل ۶MB) |
| `upload_max_filesize` | `8M` | ما multipart استفاده نمی‌کنیم، ولی بعضی هاست‌ها کنترل می‌کنند |
| `memory_limit` | `256M` | json_decode روی محتوای بزرگ + عکس‌ها |
| `max_execution_time` | `60` | درخواست‌های `ig`/`import` |
| `allow_url_fopen` | `On` | فقط برای endpoint اینستاگرام (`?action=ig`) |
| `display_errors` | `Off` | خطا نباید JSON را خراب کند (خود `api.php` هم `ini_set` می‌کند) |
| `session.save_path` | لازم نیست | ما نشست PHP استفاده نمی‌کنیم (توکن هدر) |

- اگر گزینه‌ها را در INI Editor ندیدید → **MultiPHP INI Editor → «PHP Options»** یا یک `ea-php81.ini` در `public_html` (بستگی به هاست).
- تست نهایی: `https://دامنه‌شما/api.php?action=health` →
  ```json
  {"ok":true,"app":"titanali","ver":"1.0.0","installed":false,"needSetup":true,"rev":0,"writable":true,"php":"8.2","file":"…"}
  ```
  اگر **متن `<?php` را دیدید** → PHP روی این پوشه اجرا نمی‌شود (با هاستینگ باز کنید یا `AddHandler` لازم دارند — راهنمای بخش ۱۵).
  اگر `writable:false` → بخش ۸.

---

## ۸) مجوز و مالکیت فایل‌ها (رایج‌ترین علت خطا)

cPanel → **File Manager** → انتخاب فایل‌ها → راست‌کلیک → **Change Permissions**:

- پوشه‌ها: `755` · فایل‌ها: `644`
- `titanali-data/` (و `uploads/`, `backups/`): `775` — اگر نشد `777` **موقتا** برای تست، بعد `775`
- مالکیت: باید با کاربر PHP یکی باشد. در بیشتر هاست‌های cPanel (LiteSpeed/PHP-FPM) همان کاربرِ حساب شماست (`USER:USER`)؛ اگر `nobody` است:
  ```bash
  # SSH (cPanel → SSH Access → Enable)
  cd ~ && chown -R $USER:$USER public_html titanali-data 2>/dev/null
  find public_html -type d -exec chmod 755 {} \; && find public_html -type f -exec chmod 644 {} \;
  chmod 775 titanali-data titanali-data/uploads titanali-data/backups
  df -h . ; quota -s          # دیسک پر نباشد، نوشتن شکست می‌خورد
  ```
- اگر `open_basedir` محدود است و `dataDir` بیرون `public_html` گذاشته‌اید: در cPanel → **MultiPHP INI Editor** مقدار `open_basedir` را باز کنید یا `dataDir` را داخل `public_html` (با `.htaccess` بسته) بگذارید.
- تست بسته‌بودن دیتا (باید **403/404** بگیرید، نه متن JSON):
  `https://دامنه‌شما/titanali-data/config.json`

---

## ۹) فعال‌کردن همگام‌سازی و صندوق مشترک

1. `api.php` را کنار `index.html` بگذارید (در بسته هست).
2. (اختیاری ولی بهتر) `titanali-config.sample.php` را به `titanali-config.php` تغییر نام دهید و:
   ```php
   return array(
     'dataDir'      => '/home/USER/titanali-data', // بیرون از public_html
     'proxyTrusted' => true,                       // اگر سایت پشت Cloudflare/CDN است
     'allowOrigin'  => '',                         // فقط برای دامنهٔ دیگر که درخواست می‌زند
   );
   ```
   `proxyTrusted => true` مهم است: بدون آن، **محدودیت نرخ** روی IPِ CDN می‌نشیند و همه با هم quota را پر می‌کنند.
3. سایت → کلیک روی **titanali** بالا → ورود با `admin / titanali1384` (رمز پیش‌فرض داخل `DEFAULTS.admins` است؛ این فقط برای حالت بدون-سرور).
4. پنل → **🔄 همگام‌سازی سرور** → فرم **نصب روی سرور**: نام کاربری ۳+، **رمز ۸+**، نام نمایشی → **ساخت ادمین سرور و فرستادن محتوا**.
   از این لحظه: رمز با bcrypt در `titanali-data/config.json` است، توکن ۱۲ ساعته صادر می‌شود، و ورود روی سرور بررسی می‌شود (اگر سرور قطع باشد، فهرست محلی امتحان می‌شود).
5. تب‌های **📥 صندوق پیام‌ها** را باز کنید و «📥 صندوق از سرور» بزنید → پیام‌های همهٔ بازدیدکننده‌ها اینجاست؛ با «ارسال پاسخ» جواب بدهید → پاسخ در گفتگوی همان کاربر (روی همان دستگاه/مرورگر او) می‌نشیند.
6. «🔑 رمز ادمین‌ها روی سرور» → ادمین‌های فهرست محلی را روی سرور هم می‌سازد (و رمزها را ست می‌کند). می‌توانید چند ادمین داشته باشید؛ حذف ادمین، توکن او را می‌سوزاند.
7. افزودن ادمین تازه: تب **🔐 ادمین‌ها** → ردیف تازه → «ذخیره» (محلی) → دوباره «🔑 رمز ادمین‌ها روی سرور».

**توضیح رفتار همگام‌سازی (مفید برای تیم):**
- هر «ذخیره» در پنل → ۱٫۵ ثانیه بعد `content` با `baseRev` به سرور می‌رود.
- اگر دو نفر هم‌زمان ویرایش کنند، نفر دوم `409/تعارض` می‌گیرد: در ذخیرهٔ **خودکار** فقط هشدار می‌دهد و چیزی را خراب نمی‌کند؛ در «⬆ فرستادن محتوا» صریح می‌پرسد «نسخهٔ سرور را بردارم یا نسخهٔ تو بنویسد؟». علامت `⚠ تعارض نسخه` در تب همگام‌سازی می‌ماند تا تصمیم بگیرید.
- لایک/دانلود/کامنت **روی سرور جمع می‌شوند** (overlay) و با ویرایش ادمین تداخل ندارند.
- عکس طرح‌ها: اگر سرور وصل باشد، «📷 انتخاب عکس از گالری» عکس را **روی هاست آپلود** می‌کند و آدرس سرور را جای data URL می‌گذارد (سبک‌تر و قابل‌مشاهده در همهٔ دستگاه‌ها).

---

## ۹-الف) فعال‌سازی از راه دور: با Terminal سی‌پنل یا GitHub Actions

اگر حوصلهٔ File Manager ندارید، دو راه خودکار هست. هر دو همان کاری را می‌کنند که بخش‌های بالا دستی انجام می‌دهند.

بستهٔ داخل مخزن **تکرارپذیر** ساخته می‌شود؛ پس اگر `sha256sum` عددِ دیگری جز `.sha256` کنار همان لینک داد، یا فایل ناقص آمده یا واقعاً نسخهٔ دیگری است.

### روش T — Terminal سی‌پنل (سریع‌ترین؛ چیزی در GitHub نمی‌ماند)
cPanel → **Advanced** → **Terminal**. این بلوک را یک‌جا بچسبانید (فایل‌ها از مخزن، بدون رمز):

```bash
cd ~/public_html \
 && curl -fsSL -o titanali-cpanel.zip 'https://raw.githubusercontent.com/titanali1/titanali1/latest/titanali-cpanel.zip' \
 && sha256sum titanali-cpanel.zip \
 && unzip -oq titanali-cpanel.zip && rm -f titanali-cpanel.zip \
 && chmod 644 index.html api.php sw.js site.webmanifest robots.txt sitemap.xml 404.html og.png *.png favicon.svg 2>/dev/null; \
 chmod 644 .htaccess; curl -s 'https://titanali1.ir/api.php?action=health'
```

در همین خط، `sha256sum titanali-cpanel.zip` را با محتوای `titanali-cpanel.zip.sha256` (کنار همان بسته) مقایسه کنید؛ اگر هاست به `raw.githubusercontent.com` دسترسی نداشت، آدرس را با `https://cdn.jsdelivr.net/gh/titanali1/titanali1@latest/titanali-cpanel.zip` عوض کنید یا همان زیپ را با File Manager بریزید (روش A).

**ساختن ادمین سرور** (این همان «نصب» است؛ با `read -rs` رمز در تاریخچهٔ شل نمی‌نشیند):

```bash
read -rs 'PW?رمز ادمین سرور (۱۲+ نویسه): '; echo
TA_P="$PW" python3 -c 'import json,os;print(json.dumps({"u":"admin","p":os.environ["TA_P"],"name":"ادمین سرور"}))' \
 | curl -s -X POST -H 'Content-Type: application/json' --data-binary @- 'https://titanali1.ir/api.php?action=install'
unset PW TA_P; history -c
```

خروجی درست: `{"ok":true,"token":"…","rev":0,"msg":"…"`. از این لحظه ورودِ پنل با همین رمز است و رمز پیش‌فرضِ داخل فایل بی‌اثر می‌شود.
اگر `{"ok":false,"error":"روی این سرور قبلاً نصب شده است"}` دیدید، یعنی نصب انجام شده — با همان رمز وارد شوید.

**داده را بیرون از `public_html` بگذارید** (اختیاری، ولی مسیر فایل نمونه دقیقاً همین را می‌دهد):

```bash
mkdir -p ~/titanali-data && chmod 700 ~/titanali-data \
 && cp -n ~/public_html/titanali-data/*.json ~/titanali-data/ 2>/dev/null \
 && cp ~/public_html/titanali-config.sample.php ~/public_html/titanali-config.php \
 && chmod 600 ~/public_html/titanali-config.php \
 && curl -s 'https://titanali1.ir/api.php?action=health'
```

در پاسخ، `dataDir` باید `/home/titanali/titanali-data` باشد (دیگر داخل وب نیست). اگر هاست `open_basedir` را محدود کرده و `writable:false` شد، همین `titanali-config.php` را پاک کنید تا داده به `public_html/titanali-data/` برگردد (که `.htaccess` می‌بنددش).

### روش G — GitHub Actions (بدون شل، با گزارش کامل)
فایل‌های `.github/workflows/domain-deploy.yml` و `ftp-deploy.yml` داخل مخزن‌اند. در GitHub → **Actions**:

| workflow | چه می‌کند | چه لازم دارد |
|---|---|---|
| **دامنه — بررسی و فعال‌سازی** با `step=verify` | فقط‌خواندنی: سلامت `api.php`، دامنه در `canonical`/OG/منیفست/robots/sitemap، بسته‌بودن `titanali-data/`، `http→https`، در دسترس‌بودن `www`، و اینکه فایل‌های هاست با مخزن یکی‌اند یا کهنه | هیچ چیز |
| همان، `step=install` | یک بار `action=install` را می‌زند و ادمین سرور را می‌سازد (و با `login` اثبات می‌کند رمز کار می‌کند) | رازهای `TA_ADMIN_USER`، `TA_ADMIN_PASS` (و اختیاری `TA_ADMIN_NAME`) |
| همان، `step=verify-then-install` | بررسی، نصب، بررسی دوباره | مثل بالا |
| **دامنه — همگام‌سازی فایل‌ها با FTP** | `dist/titanali-cpanel` را می‌سازد و با FTP بالای `public_html` می‌فرستد (پیش‌فرض `dry-run: true` است؛ برای نوشتن واقعی خاموشش کنید) | رازهای `FTP_HOST`، `FTP_USER`، `FTP_PASS` |

رازها: GitHub → Settings → **Secrets and variables → Actions** → *New repository secret*. هیچ رمز یا توکنی در لاگ چاپ نمی‌شود (اسکریپت‌ها `deploy/verify-site.sh` و `deploy/install-api.sh` هستند و روی ماشین خودتان هم اجرا می‌شوند؛ برای تست محلی: `python3 tests/mock-api.py 8099`).

بعد از موفقیت، رازها را پاک کنید: `gh secret delete TA_ADMIN_PASS TA_ADMIN_USER` (یا از همان صفحهٔ Settings). اگر از Actions نصب کردید، همین حالا رمز را از پنل عوض کنید: تب «ادمین‌ها» → رمز تازه → «ذخیره» → تب «همگام‌سازی سرور» → «🔑 رمز ادمین‌ها روی سرور».

## ۱۰) کش، به‌روزرسانی و دیدن نسخهٔ تازه

- HTML با `max-age=0, must-revalidate` سرو می‌شود؛ سرویس‌ورکر برای صفحه «شبکه‌اول» است → ویزیتورها نسخهٔ تازه را می‌بینند.
- `.htaccess` برای `api.php` کش را خاموش کرده (`CacheLookup off` + `no-store`) تا روی LiteSpeed هم پاسخ صندوق/محتوا منجمد نشود.
- **اگر بعد از دیپلوی تغییر را ندیدید** به‌ترتیب: ۱) `Ctrl+Shift+R` ۲) DevTools → Application → Service Workers → **Unregister/Update** ۳) برای همهٔ کاربران، شمارهٔ نسخه در `deploy/files/sw.js` را بالا ببرید و دوباره بسته را بسازید:
  ```js
  const V = 'titanali-v2';   // کش‌های قدیمی خودکار پاک می‌شوند
  ```
  (با تغییر `V`، سرویس‌ورکر تازه نصب و `skipWaiting()` می‌کند → حداکثر یک بازدید بعد، همه نسخهٔ تازه را دارند.)
- اگر هاست «**LiteSpeed Cache**» یا کش پروکسی (Varnish) فعال دارد: در تنظیمات آن `cache exclude` روی `*.php*` و `/titanali-data/*` بگذارید.
- عکس‌های `titanali-data/uploads/*` نام هَش‌شده دارند → کش یک‌ساله بی‌خطر است (با هر فایل تازه، نام عوض می‌شود).

---

## ۱۱) پشتیبان‌گیری و بازگردانی

**خودکار روی هاست**
- cPanel → **Backup Wizard** (یا **JetBackup** در هاست‌های خوب): هفته‌ای یک‌بار **Full Backup** + روزانه برای `public_html` و `titanali-data`.
- `api.php` قبل از هر `import` یک نسخه در `titanali-data/backups/backup-YYYYMMDD-HHMMSS.json` می‌گذارد (۱۰ نسخهٔ چرخشی).

**دستی از پنل**
- **خروجی JSON** (محتوا) و در تب همگام‌سازی «🧾 خروجی کامل (با پیام‌ها)» ← `?action=export` که `content + social + inbox + log` را یک‌جا می‌دهد.
- ورود: «⬆ ورودی JSON» در پنل (محلی) — یا `?action=import` که اول بکاپ می‌گیرد.

**با SSH (کرون هفتگی)**
```bash
# cPanel → Cron Jobs → هر جمعه ۰۳:۳۰
30 3 * * 5 tar czf $HOME/backups/titanali-$(date +\%F).tar.gz $HOME/public_html/titanali-data $HOME/public_html/index.html
```
(اول `mkdir -p ~/backups` را یک‌بار اجرا کنید.)

**بازگردانی:** زیپ بکاپ را در `public_html` استخراج کنید + اگر `titanali-data` هم بازیابی می‌شود، کش سرویس‌ورکر را با بالا بردن `V` بشکنید.

---

## ۱۲) لاگ و آمار

- cPanel → **Metrics → Errors** (آخرین خطاهای Apache/LiteSpeed — اولین جایی که باید در خطای ۵۰/۴۰۳ دید).
- **Raw Access Logs** / **Awstats** برای ترافیک.
- `titanali-data/log.json`: آخرین ۲۰۰ تغییر محتوا با نام کاربر و زمان (فقط از راه `?action=export` قابل‌دیدن است، وب نمی‌شود).
- شمارش‌های سرور: `https://دامنه‌شما/api.php?action=stats` → `{likes, dl, views, comments, messages, rev}`.
- `display_errors` خاموش است؛ برای دیباگِ موقت `api.php` را با `ini_set('display_errors','1')` باز کنید و بعد ببندید.

---

## ۱۳) امنیت — آنچه روی cPanel باید اضافه کنید

| آیتم cPanel | تنظیم پیشنهادی | چرا |
|---|---|---|
| **Security → Two-Factor Authentication** | روشن | دسترسی به فایل‌ها یعنی دسترسی به رمزها |
| **SSL/TLS → Enable TLS 1.2+** | TLS 1.2 و 1.3 فقط | |
| **ModSecurity** | روشن؛ فقط در صورت ردکردن ذخیرهٔ محتوا، «Disable for this domain» موقت + گزارش **Rule ID** به هاستینگ | JSON با متن فارسی/HTML گاهی تریگر می‌شود (علامت: ۴۰ یا «Not Acceptable») |
| **IP Blocker / IP Manager** | فقط اگر لازم شد | برای آبیوز پیام‌ها؛ api.php خودش محدود نرخ دارد |
| **Hotlink Protection** | اگر روشن کردید، `og.png` را بلاک **نکند** | ربات تلگرام/واتساپ برای پیش‌نمایش لینک باید بتواند `og.png` را بگیرد |
| **Directory Privacy (.htpasswd)** | روی `public_html` **نگذارید** | کل سایت برای همه قفل می‌شود. اگر می‌خواهید، یک زیرپوشهٔ جدا برای ابزار ادمین بسازید |
| **SSH Access → «Disable password authentication»** | روشن اگر SSH زیاد استفاده می‌کنید | |
| **`titanali-data`** | بیرون از `public_html` + `.htaccess` deny (خودکار) | چک کنید با بازکردن `titanali-data/config.json` باید ۴۰/۴۰۴ باشد |
| **PHP in uploads** | `.htaccess` داخل `uploads/` اجرا را می‌بندد (خودکار ساخته می‌شود) | |
| **رمز ادمین** | فقط روی سرور (bcrypt) | رمز `DEFAULTS.admins` در سورس، برای حالت آفلاین است و اگر بستهٔ زیپ را عمومی بگذارید، خوانده می‌شود → نصب روی سرور را انجام دهید و از تب ادمین‌ها عوضش کنید |

**صداقت فنی:** ورود پنل سمت کلاینت **به‌تنهایی** امنیت نیست (سورس عمومی است). امنیت واقعی همین است که `api.php` را نصب کنید تا رمز سمت سرور باشد؛ اما حتی آن‌هم «ذخیرهٔ محتوا» را برای هر کسی که توکن دارد آزاد می‌گذارد — پس رمز قوی و 2FA روی cPanel لازم است.

---

## ۱۴) چرخهٔ به‌روزرسانی سایت (کار روزمره)

```bash
git pull origin arena/874bf68b-titanali1
$EDITOR index.html                 # یا فقط محتوای DEFAULTS را عوض کنید
python3 deploy/make-cpanel.py     # بسته، آیکون‌ها، og.png، زیپ، sha256
# اگر sw.js را عوض کردید شمارهٔ V را بالا ببرید
git add -A && git commit -m "…" && git push origin arena/874bf68b-titanali1
```
بعد روی هاست: زیپ تازه را در `public_html` استخراج کنید (Overwrite).

اگر بک‌اند نصب کرده‌اید، **محتوا روی سرور زندگی می‌کند** و `DEFAULTS` فقط نسخهٔ اولیه است. برای اینکه ویرایش دستی کد با محتوای سرور درگیری ایجاد نکند، این ترتیب را رعایت کنید:

1. در پنل: «⬇ گرفتن از سرور» (تا آخرین نسخهٔ تیم را داشته باشید)
2. ویرایش → «⬆ فرستادن محتوا به سرور» (اگر لازم است `force` → بازنویسی)
3. فقط برای تغییرات ساختاری/متن‌های ثابت، `DEFAULTS` را ویرایش و دیپلوی کنید.

---

## ۱۵) عیب‌یابی (اول این جدول، بعد لاگ)

| نشانه | علت رایج | کار |
|---|---|---|
| صفحهٔ سفید / ۴۰۴ کل سایت | فایل‌ها در زیرپوشه رفته‌اند | `public_html/index.html` را چک کنید؛ «Document Root» را درست کنید |
| **۵۰۰ Internal Server Error** | خطای `.htaccess` روی ماژول کم‌شده | با File Manager `.htaccess` را موقتاً به `.htaccess_` تغییر نام دهید؛ اگر درست شد، به‌ترتیب این بلوک‌ها را کامنت کنید: `mod_brotli` → بلوک CSP → `Expires`. روی بعضی هاست‌ها `AddType application/x-httpd-php` لازم/ممنوع است |
| `.htaccess` آپلود/استخراج نشده | فایل مخفی | در File Manager «Show hidden files» و در FileZilla «Force showing hidden files»، بعد دوباره آپلود |
| عکس‌ها/طرح‌ها خالی | مسیر `og.png`/آیکون‌ها نیست | چک کنید ۵ فایل PNG کنار `index.html` باشند؛ یا `python3 deploy/make-cpanel.py` (نیازمند Pillow) و دوباره آپلود |
| پیش‌نمایش لینک در تلگرام تصویری ندارد | `og.png` نبود یا `og:image` به دامنهٔ دیگر اشاره می‌کند | `https://دامنه/og.png` را باز کنید؛ `og:image` و `SITE` را با دامنهٔ واقعی ست کنید؛ در **BotFather** با `/feedback` کش تلگرام را بشکنید |
| `api.php?action=health` متن `<?php` برمی‌گرداند | PHP در آن پوشه اجرا نمی‌شود | **Select PHP Version** را برای دامنه ست کنید؛ از هاستینگ بخواهید؛ (سایت بدون بک‌اند درست کار می‌کند) |
| `403 Forbidden` روی `api.php` | ModSecurity یا Rule هاست | `Metrics → Errors` را ببینید؛ Rule ID را Temporarily disable کنید و گزارش دهید |
| `404` روی `api.php` | فایل را در زیرپوشه گذاشته‌اید ولی `D.settings.api` تنظیم نیست | پنل → تنظیمات → «آدرس بک‌اند» را مثلاً `/site/api.php` کنید |
| `writable:false` | مجوز/مالکیت `titanali-data` یا دیسک پر | بخش ۸؛ `df -h` |
| ذخیرهٔ پنل «ارتباط با سرور برقرار نشد» | ۴۰/۴۱/۴۲۹/۵۰۰ که در تب همگام‌سازی نوشته می‌شود | توضیح هرکدام پایین همین جدول |
| ۴۰۱ «نشست تمام شده» | توکن ۱۲ ساعته منقضی | دوباره وارد شوید (تب همگام‌سازی → وضعیت) |
| ۴۰۹ «تعارض نسخه» | دو نفر هم‌زمان ذخیره کرده | «⬇ گرفتن از سرور» بعد از کپی تغییرات خودتان، یا «⬆ فرستادن محتوا» برای بازنویسی |
| ۴۱۳ | پیوست بزرگ‌تر از سقف (۶MB فایل / ۶MB JSON) | عکس را کوچک کنید یا `post_max_size` را بالا ببرید |
| ۴۱۵ | مهمان فایل غیرتصویری فرستاده | سیاست سرور است (مهمان فقط jpeg/png/webp) |
| ۴۲۳ | `api.php` هست اما نصب نشده | تب همگام‌سازی → فرم نصب |
| ۴۲۹ | محدود نرخ | ۱ تا ۱۰ دقیقه صبر؛ اگر همه کاربران با هم ۴۲۹ می‌گیرند → `proxyTrusted => true` (Cloudflare) |
| پیام‌ها در صندوق نمی‌آید | بک‌اند نصب نشده/قطع است، یا «📥 صندوق از سرور» را نزدید | تب همگام‌سازی → ↻ تست اتصال |
| پاسخ ادمین برای کاربر نرفته | کاربر با مرورگر/دستگاه دیگری برگشته (داده محلی) یا ۴۵ ثانیه نگذشته | گفتگو را رفرش کنید؛ `sid` همان باید بماند (اگر پاک کرده باشد، گفتگو جدا می‌شود) |
| در سایت، تغییرات من به دیگران نمی‌رسد | بک‌اند نصب نشده (محلی کار می‌کند) یا «⬆ فرستادن محتوا» نزدید | تب همگام‌سازی → وضعیت باید `متصل به سرور` و `rev` بالا باشد |
| عکس طرح‌ها در دستگاه دیگر نیست | بک‌اند موقع آپلود عکس فعال نبوده (data URL فقط محلی است) | `API` وصل باشد و دوباره «📷 انتخاب عکس از گالری» بزنید تا روی سرور آپلود شود |
| فونت/آیکون‌ها نمی‌آید | CSP سخت‌گیرانه با اسکریپت بیرونی اضافه‌شده | `.htaccess` → `script-src`/`style-src`/`font-src` را باز کنید (ما همه‌چیز درون‌خطی داریم، پس نیاز نیست) |
| سایت روی موبایل APK نصب نمی‌شود/manifest خطا | `site.webmanifest` با MIME اشتباه | چک کنید: `curl -I https://دامنه/site.webmanifest` باید `application/manifest+json` بدهد (`.htaccess` ما `AddType` دارد) |
| فقط در یک مرورگر SSL خطا | SNI/کش | `curl -Iv https://دامنه/` روی SSH؛ AutoSSL دوباره |
| هاست «Disk quota exceeded» | بکاپ/لایک لاگ‌ها | `titanali-data/backups` و `uploads` را مرور کنید؛ زیپ‌های استخراج‌نشده را پاک کنید |

**چک‌لیست ۶ خطی (روی SSH یا با `curl` محلی):**

```bash
D=https://دامنه‌شما
curl -sI  $D/                          | head -3                      # 200 text/html
curl -sI  $D/site.webmanifest          | grep -i content-type         # application/manifest+json
curl -s   $D/api.php?action=health                                     # {"ok":true,…,"writable":true}
curl -sI  $D/titanali-data/config.json | head -1                      # 403 یا 404 (نه 200!)
curl -sI  $D/robots.txt                | head -1                      # 200
curl -s   $D/api.php?action=stats                                      # شمارش‌ها
```

---

## ۱۶) غیرفعال/حذف کردن بک‌اند (بازگشت به استاتیک محض)

`api.php` را پاک (یا جابه‌جا) کنید — همین. سایت خودکار `API.on=false` می‌شود و به حالت «فقط این مرورگر» برمی‌گردد؛ هیچ خطایی هم نمی‌دهد (تست `test5.js` دقیقاً همین حالت را پوشش می‌دهد).
برای پاک‌کردن دیتا هم: `titanali-data/` را منتقل/حذف کنید. محتوای روی سرور را قبلش با «🧾 خروجی کامل» بگیرید.

---

## ۱۷) چک‌لیست انتشار (آخر کار، همه باید ✅ باشد)

- [ ] `https://دامنه/` بدون خطای کنسول باز می‌شود و فید اینستاگرام یک پست با پِیجر نشان می‌دهد.
- [ ] `https://دامنه/api.php?action=health` → `"ok":true`, `"writable":true`.
- [ ] `https://دامنه/titanali-data/config.json` → **403/404**.
- [ ] `https://دامنه/site.webmanifest` → `application/manifest+json` و `sw.js` → `200`.
- [ ] پنل با رمز **سرور** باز می‌شود و تب همگام‌سازی «متصل به سرور» + `rev > 0` است.
- [ ] «ذخیره» در پنل → پیام «روی سرور هم ذخیره شد ✓ (rev …)».
- [ ] از یک دستگاه دوم (مثلاً گوشی با نت موبایل) محتوای تازه دیده می‌شود.
- [ ] پیام آزمایشی از «گفتگو» → در «📥 صندوق از سرور» روی دستگاه ادمین می‌آید؛ پاسخ می‌دهید و در همان گفتگو ظاهر می‌شود.
- [ ] `https://دامنه/og.png` باز می‌شود و در تلگرام (بعد از چند دقیقه) پیش‌نمایش لینک می‌آید.
- [ ] SSL سبز، `http://` خودش به `https://` می‌رود، `www` هم درست ریدایرکت می‌شود.
- [ ] Backup Wizard زمان‌بندی‌شده؛ یک‌بار دستی **Download** هم گرفته‌اید.
- [ ] `404.html` با یک آدرس اشتباه (`/xyz`) نمایش داده می‌شود.
- [ ] روی موبایل: «افزودن به صفحهٔ اصلی» → آیکون تیتانلی و باز شدن تمام‌صفحه.

---

## ۱۸) پرسش‌های پرتکرار

**آیا اینستاگرام خودکار همگام می‌شود؟** نه به‌طور قابل‌اتکا. endpoint `?action=ig` تلاش می‌کند و ۳۰ دقیقه کش می‌کند، اما اینستاگرام معمولاً درخواستِ سمت سرور را بلاک/ری‌دایرکت می‌کند. روش عملیِ ما همان است که در پنل هست: **«چسباندن JSON»** (خروجی ابزار/اکسپورت) یا افزودن دستی طرح‌ها. برای همگام‌سازی واقعی باید **Meta Graph API** (حساب Business + توکن) وصل شود — این کد را اگر بخواهید اضافه می‌کنم.

**چرا دیتابیس نه؟** برای یک کارگاه با چند ادمین و چند صد پیام، فایل JSON با `flock` ساده‌تر، قابل‌بکاپ‌گیری و قابل‌حمل است و روی هر هاستی کار می‌کند. اگر ترافیک/هم‌زمانی بالا رفت (مثلاً نوشتن صدها لایک در ثانیه)، مهاجرت به MySQL/Postgres را انجام می‌دهیم — ساختار endpoint‌ها عوض نمی‌شود، فقط لایهٔ ذخیره.

**پیامک/ایمیل به ادمین می‌آید؟** نه؛ پاسخ‌وجوی گفتگو هر ۴۵ ثانیه و فقط وقتی تب باز است انجام می‌شود. اگر بخواهید، با `mail()` PHP یک اعلان «پیام تازه» (با throttle) اضافه می‌کنم.

**چند ادمین؟** نامحدود؛ روی سرور با bcrypt و توکن مستقل. حذف/تغییر رمز از تب‌های «ادمین‌ها» و «همگام‌سازی سرور». آخرین ادمین حذف نمی‌شود.

**دیتای من کجاست؟** فقط روی هاست خودتان: `titanali-data/*.json`. هیچ درخواست بیرونی جز تلاشِ اختیاری `ig` به اینستاگرام زده نمی‌شود (CSP: `connect-src 'self' https://i.instagram.com https://www.instagram.com`).

**اگر هاست PHP را ببندد چه؟** سایت از کار نمی‌افتد: حالت محلی (`localStorage`) فعال می‌ماند. فقط همگام‌سازی/صندوق مشترک موقتاً می‌خوابد و پیام‌ها در همان مرورگرها می‌مانند تا سرور برگردد.

---

## ۱۹) ضمیمه

### بازسازی بسته از صفر (روی ماشین خودتان)
```bash
git clone -b arena/874bf68b-titanali1 https://github.com/titanali1/titanali1.git
cd titanali1
python3 -m pip install pillow arabic-reshaper python-bidi   # فقط برای og.png و آیکون‌ها
python3 deploy/make-cpanel.py          # dist/titanali-cpanel/ + زیپ + sha256 در ریشه
```
اگر Pillow نصب نباشد، اسکریپت بدون PNGها بسته را می‌سازد و هشدار می‌دهد (SVG و favicon کار می‌کنند).

### همهٔ endpoint های `api.php`
`health` · `install` · `login` · `logout` · `me` · `content` (GET عمومی، POST ادمین با `baseRev`) · `social` · `metric` · `comment` · `comment_del` · `send` · `thread&sid=` · `inbox` · `reply` · `read` · `thread_del` · `upload` · `file&f=` · `admins` · `export` · `import` · `stats` · `ig`
(ادمینی‌ها با هدر `X-TA-Token: <tok>`؛ `?t=<tok>` هم پذیرفته می‌شود اگر هاست هدر `Authorization` را حذف کند.)

### فایل‌های مرجع در مخزن
`index.html` (کل سایت) · `api.php` (بک‌اند) · `deploy/files/.htaccess|sw.js|404.html|robots.txt|sitemap.xml|titanali-config.sample.php` (قالب‌ها؛ با هر اجرای اسکریپت به ریشه کپی می‌شوند، پس **همان‌جا** ویرایش کنید) · `deploy/make-cpanel.py` · `README.md` (مستندات فنی/پنل) · `titanali-cpanel.zip` + `.sha256` (بستهٔ آماده).
