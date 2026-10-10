# تست‌ها

| فایل | چی می‌سنجد | اجرا |
|---|---|---|
| `run.js` (۱۱۴ بررسی) | سایت در **حالت استاتیک/محلی** (فید اینستاگرامی بدون قاب، لایک/کامنت/دانلود، ورود ادمین (بدون راهنمای زیر فرم)، ۱۵ تب پنل، ابزار ردیف‌ها (↑↓⧉★✕ + JSON ردیف)، متن‌های سایت (i18n)، دکمه‌ها و جاهایشان، تنظیمات فید، پذیرش فایل منتشرشده، فایل‌های بسته، دامنه در متاتگ‌ها) | `node tests/run.js` |
| `sync.js` (۶۴ بررسی) | همان سایت با **بک‌اند شبیه‌سازی‌شده**: adopts سرور، overlay شمارنده‌ها، `metric/comment/send/thread/reply/install/content(409)`، تعارض rev، حذف کامنت، خروج، **و انتشار**: `publish`(+self)، `state`، `baked`، نوشتن فایل ایستا، انتشار خودکار پس از ذخیره، نوار «منتشرنشده»/«هم‌سان»، تعارض ۴0۹ و «گرفتن از سرور»، `ig`+`D.ig.feed`، پذیرش snapshot منتشرشده توسط بازدیدکننده | `node tests/sync.js` |
| `php-syntax.py` | سینتکس `api.php` (بی‌نیاز از مفسر PHP) | `python3 tests/php-syntax.py` |

نصب وابستگی‌ها (یک‌بار):

```bash
npm i jsdom                       # در ریشهٔ مخزن؛ tests/ از همان node_modules بالا استفاده می‌کند
pip install --break-system-packages phply     # اختیاری
```

خروجی هر سوئیت خط آخری به شکل `RESULT pass=… fail=… consoleErrors=…` دارد و در حالت موفق `0` برمی‌گرداند — برای CI کافی است:

```bash
node tests/run.js && node tests/sync.js && python3 tests/php-syntax.py
```

## موکِ بک‌اند (برای تست اسکریپت‌های استقرار)

```bash
python3 tests/mock-api.py 8099 &                 # سایت + api.php ساختگی، از ریشهٔ مخزن
NO_TLS=1 SKIP_DOMAIN=1 bash deploy/verify-site.sh http://127.0.0.1:8099/
TA_ADMIN_USER=admin TA_ADMIN_PASS=devpass-1234 bash deploy/install-api.sh http://127.0.0.1:8099/

# و تمرین «نصب کامل روی هاست» روی یک public_html ساختگی:
mkdir -p ~/fakehome/public_html
SITE=http://127.0.0.1:8099 PUB=~/fakehome/public_html ZIP_FILE=../titanali-cpanel.zip \
  MOVE_DATA=1 TA_ADMIN_USER=admin TA_ADMIN_PASS=devpass-1234 bash deploy/install-on-server.sh < /dev/null
```

دادهٔ موک در `.mockapi/` می‌نشیند (در `.gitignore`)؛ پاکش کنید: `rm -rf .mockapi`.

> `tests/` بخشی از بستهٔ آپلودی روی هاست **نیست**؛ فقط برای توسعه است.

## تمرین انتشار روی هاست (با موک)

```bash
python3 tests/mock-api.py 8123 &                      # موکِ کامل api.php (publish/state/baked/ig هم دارد)
curl -s "http://127.0.0.1:8123/api.php?action=health" | head -c 200
TA_ADMIN_USER=admin TA_ADMIN_PASS='passw0rd-1234' bash deploy/install-api.sh http://127.0.0.1:8123
curl -s "http://127.0.0.1:8123/api.php?action=baked" | head -c 120      # هنوز بیک نشده
curl -s -X POST -H "X-TA-Token: …" -H 'Content-Type: application/json' \
     -d '{"data":{"profile":{"name":"تست"}}}' "http://127.0.0.1:8123/api.php?action=publish"
curl -s "http://127.0.0.1:8123/titanali-content.json" | head -c 120     # فایل ایستای ساخته‌شده
```

موک هم مثل `api.php` فایل را کنار «public_html» می‌نویسد (در موک: ریشهٔ مخزن، و در `.gitignore` است) تا مسیرِ واقعیِ انتشار همان مسیری باشد که روی هاست می‌بینید.
