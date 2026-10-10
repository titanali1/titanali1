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

> `tests/` بخشی از بستهٔ آپلودی روی هاست **نیست**؛ فقط برای توسعه است.
