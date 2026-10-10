# تست‌ها

| فایل | چی می‌سنجد | اجرا |
|---|---|---|
| `run.js` | سایت در **حالت استاتیک/محلی** (قاب تک‌پست، لایک/کامنت/دانلود، ورود ادمین با کلیک روی عنوان، پنل، ویرایش و ذخیره، گالری/لایت‌باکس، گفتگو و صندوق، فایل‌های بسته، دامنه در متاتگ‌ها) | `node tests/run.js` |
| `sync.js` | همان سایت با **بک‌اند شبیه‌سازی‌شده**: adopts سرور، overlay شمارنده‌ها، `metric/comment/send/thread/reply/install/content(409)`، تعارض rev، حذف کامنت، خروج | `node tests/sync.js` |
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
