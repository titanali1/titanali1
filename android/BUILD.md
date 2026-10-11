# ساخت و امضای نسخهٔ قابل نصب (AAB/APK)

پیش‌نیاز روی ماشین شما (لینوکس/ویندوز/مک):
- **JDK 17** — با Android Studio می‌آید (`Studio → Settings → Build Tools → …` یا `java -version`)
- **Android SDK**: Platform 36 + Build-Tools — ساده‌ترین راه، نصب [Android Studio](https://developer.android.com/studio) است
- **Python 3** (برای اسکریپت‌های همگام‌سازی) و **Gradle 8.13+** اگر از خط فرمان می‌سازید

> در محیط‌های ایزوله/کانتینری که به `dl.google.com` دسترسی نیست build ممکن نیست؛ اینجا همان
> مسیری را می‌سازیم که روی لپ‌تاپ شما کار می‌کند. همهٔ فایل‌های لازم در این پوشه هست.

---

## ۱) باز کردن پروژه
```
Android Studio → File → Open → پوشهٔ android/ را انتخاب کنید
```
- اولین همگام‌سازی (`Sync`) خودش `gradle wrapper` و SDK Manager را پیشنهاد می‌دهد: قبول کنید
  (اگر `License not accepted` داد: `sdkmanager --licenses` و `y`).
- فایل `gradle/wrapper/gradle-wrapper.jar` **عمداً در مخزن نیست** (مخزن بدون باینری بماند). اگر خواستید
  از خط فرمان بسازید: `gradle wrapper --gradle-version 8.13` — یا همان build را در Android Studio بزنید
  (Build → Generate Signed App Bundle / APK) که خودش wrapper را می‌سازد.
- اگر موقع build گفت «AGP 8.11.1 not found» یا «upgrade assistant» → دکمهٔ **Upgrade** را بزنید؛
  فقط `agpVersion` در `gradle.properties` عوض می‌شود و هیچ کدی دست‌نخورده می‌ماند.

## ۲) همگام‌سازی پوسته و آیکون‌ها
```bash
cd android
python3 tools/prepare-web.py      # index.html سایت → app/src/main/assets/web + نسخه‌ها
python3 tools/prepare-icons.py    # icon-192/512 و maskable-512 → mipmapها و store/
```
`gradle` هم قبل از build همان کپی را خودش انجام می‌دهد (task `syncSiteAssets`)؛ اجرای دستی برای
اطمینان و دیدن گزارش است. برای دیدن تنظیمات فعلی: `./gradlew appInfo`.

## ۳) کلید امضا (یک‌بار — بعد گم کردنش فاجعه است)
```bash
bash tools/make-keystore.sh
```
`titanali-release.jks` + `keystore.properties` می‌سازد (هر دو در `.gitignore`).
- یک **پشتیبان رمزنگاری‌شده** روی فلش/درایو بگیرید.
- در گوگل‌پلی «Play App Signing» روشن می‌ماند؛ کلید شما کلید *آپلود* است، کلید امضای نهایی را
  گوگل نگه می‌دارد. در مایکت/کافه‌بازار همین کلید، کلید نهایی است.

## ۴) build
```bash
bash tools/build-release.sh          # AAB (برای پلی) + APK (برای مایکت/بازار)
bash tools/build-release.sh apk      # فقط APK
# یا دستی:
./gradlew bundleRelease assembleRelease
```
خروجی:
```
app/build/outputs/bundle/release/app-release.aab
app/build/outputs/apk/release/app-release.apk
```
بدون `keystore.properties`، خروجی **امضاشده نیست** و مارکت قبول نمی‌کند (اسکریپت هشدار می‌دهد).

### تست روی گوشی
```bash
./gradlew installDebug            # یا: adb install -r app/build/outputs/apk/debug/app-debug.apk
```
`appId` نسخهٔ debug با `.debug` تمام می‌شود → کنار نسخهٔ اصلی نصب می‌ماند و اذیت نمی‌کند.

### اگر خواستید `adb` بدون Studio
`platform-tools` را از `sdkmanager platform-tools` بگیرید؛ در ویندوز `adb.exe` در
`%LOCALAPPDATA%\Android\Sdk\platform-tools` است.

## ۵) CORS: تا این را نکنید، اپ فقط آفلاین است
صفحهٔ اپ از مبدأ ساختگی `https://app.titanali1.ir/` باز می‌شود، پس درخواست‌هایش به
`api.php` «cross-origin» حساب می‌شود. `api.php` این نسخه از همان اول یک allowlist دارد؛ فقط در
`public_html/titanali-config.php` اضافه‌اش کنید:
```php
return [
    // …
    'appOrigins' => ['https://app.titanali1.ir'],
];
```
(پیش‌فرضِ کد هم همین مقدار را دارد؛ اگر `titanali.appHost` را عوض کردید، حتماً همین‌جا هم بنویسید.)

اعتبارسنجی سریع با `curl`:
```bash
curl -sI -X OPTIONS -H 'Origin: https://app.titanali1.ir' \
     -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: x-ta-token' \
     'https://titanali1.ir/api.php?action=send' | grep -i 'access-control'
# باید هر سه هدر Access-Control-* برگردند
```

## ۶) (اختیاری) باز شدن لینک‌های سایت داخل اپ
مانيফست `intent-filter` را گذاشته ولی با `autoVerify="false"` (تا بدون فایل تأیید، بازبینی
پلی ایراد نگیرد). برای verified links:
```bash
bash tools/assetlinks.sh            # خروجی JSON را می‌دهد (از اثر انگشتِ App signing key در پلی)
# → public_html/.well-known/assetlinks.json
```
سپس در `AndroidManifest.xml` → `android:autoVerify="true"` و build دوباره.
تأیید: `adb shell pm get-app-links ir.titanali1.app` باید `verified` بدهد.

## ۷) حالت‌های اجرا
| حالت | چه می‌شود | کِی |
|---|---|---|
| پیش‌فرض (`remoteFirst=false`) | نسخهٔ بسته‌بندی‌شده از assets + تماس با `api.php` هاست؛ آفلاین هم کار می‌کند | انتشار عمومی |
| `titanali.remoteFirst=true` | مستقیم `https://titanali1.ir/` را باز می‌کند؛ همیشه تازه، بدون آفلاین | اگر می‌خواهید هر تغییر سایت بی‌build برسد |

برای تست: `./gradlew assembleRelease -Ptitanali.remoteFirst=true`
(این `buildConfigField` است؛ برای نسخهٔ نهایی در `gradle.properties` ثبتش کنید تا تکرارپذیر باشد.)

## ۸) به‌روزرسانی بعد از هر تغییر سایت
```bash
python3 android/tools/prepare-web.py   # پوسته + versionName/versionCode
bash android/tools/build-release.sh
# AAB → Play Console (مسیر Production)؛ APK → مایکت/کافه‌بازار
```
`versionCode` خودکار از نسخهٔ سایت می‌آید (مثلاً `1.0.8 → 10008`)؛ پلی فقط عدد بزرگ‌تر را قبول می‌کند.

## ۹) عیب‌یابی
| علامت | علت / کار |
|---|---|
| صفحهٔ سیاه، لاگ: `net::ERR_…` روی `app.titanali1.ir` | `assets/web/index.html` خالی است → `python3 tools/prepare-web.py` |
| سایت باز می‌شود ولی «سرور پاسخ نداد» | CORS بند ۵، یا `titanali.api` آدرس غلط دارد |
| `Cannot find symbol: BuildConfig` | `buildFeatures { buildConfig true }` را حذف کرده‌اید |
| `Signing ... not found` | مسیر `storeFile` در `keystore.properties` نسبت به پوشهٔ `android/` نوشته شود |
| پلی گفت `wv in user agent` | در `configureWebView` حذف `; wv` را برن‌دارید |
| پلی گفت «وب‌سایت بسته‌بندی‌شده بدون کارایی افزوده» | حالت آفلاین + میان‌بُرها + پیوست دوربین + دریافت فایل را نگه دارید و در «Privacy/جواب بازبینی» توضیح دهید؛ اگر بازم گیر داد، چند قابلیت بومی دیگر اضافه کنید (مثلاً اعلان پیام تازه) |
| صفحه پایین‌تر از نوار وضعیت می‌شود/کیبورد روی کادر پیام است | insetها در `onCreate` اعمال شده؛ اگر `WindowInsets` را دستی change کردید به `WindowInsetsCompat.CONSUMED` برگردانید |
| تصویرهای ارسالی کاربر در پنل (تب صندوق) باز نمی‌شود | `api.php` نسخهٔ قدیمی روی هاست است؛ آپدیتش کنید (`?action=file`) |

## ۱۰) بررسی نهایی پیش از آپلود
```bash
aapt2 dump badging app/build/outputs/apk/release/app-release.apk | head -5
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```
باید: `package: name='ir.titanali1.app'`, `targetSdkVersion:'36'`, `minSdkVersion:'24'`,
`versionCode` بزرگ‌تر از نسخهٔ قبلی، و «Uses Permissions» فقط `INTERNET`/`ACCESS_NETWORK_STATE`/
`VIBRATE`/`WRITE_EXTERNAL_STORAGE (≤28)` باشد.
