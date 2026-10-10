# اپلیکیشن اندروید تیتانلی 📱

پوستهٔ بومیِ همان سایت: سایت تک‌فایل (`../index.html`) داخل یک `WebView` بسته‌بندی می‌شود،
**با محتوای آفلاین** (طرح‌ها و متن‌ها روی گوشی می‌مانند و بدون اینترنت هم کار می‌کنند) و
پل بومی برای اشتراک‌گذاری، لرزش، انتخاب فایل/دوربین و دریافت تصویر.

> این پوشه فقط **کد پروژهٔ اندروید** است. ساخت `.aab`/`.apk` به Android SDK نیاز دارد که در
> این مخزن (و در محیط توسعهٔ تحت وب) نصب نیست؛ با `tools/build-release.sh` روی ماشین خودتان
> در چند دقیقه آماده می‌شود → 👉 [BUILD.md](BUILD.md)

## چه چیزی «اپ»ش می‌کند (نه فقط یک سایت باز‌شده)
| قابلیت | کجا |
|---|---|
| محتوای آفلاین: نسخهٔ سایت داخل `assets/web` است و بدون شبکه باز می‌شود | `SiteAssetHandler.java` |
| نوار «اتصال نیست» + صفحهٔ آفلاین + تلاش دوباره | `MainActivity.java`, `assets/web/offline.html` |
| پیوست گفتگو با گالری **و دوربین** (FileProvider) | `MainActivity.onShowFileChooser` |
| دریافت تصویر/فایل با DownloadManager (پیام‌ها و فایل‌های `data:`) | `onDownload` / `saveDataUrl` |
| اشتراک بومی، کپی، لرزش، باز کردن لینک در برنامهٔ خودش (تلگرام/واتساپ/اینستا) | `Bridge.java` → `window.TitanaliApp` |
| میان‌بُرها (long-press آیکون → «طرح‌ها» / «گفتگو برای سفارش») | `res/xml/shortcuts.xml` |
| باز کردن لینک‌های `titanali1.ir` در اپ | `intent-filter` + `assetlinks.sh` |
| صفحهٔ بازگشت هوشمند: اول تاریخچهٔ سایت، بعد «دو ضربه برای خروج» | `OnBackPressedCallback` |
| edge-to-edge و safe-area (الزام API 36) بدون پرش کیبورد | `activity_main.xml` + insets |

## ساختار
```
android/
├── settings.gradle  build.gradle  gradle.properties     ← نسخه‌ها و آدرس‌ها یک‌جا همین‌جا
├── gradle/wrapper/gradle-wrapper.properties
├── app/
│   ├── build.gradle          ← compileSdk/targetSdk 36، minSdk 24، امضا از keystore.properties
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/ir/titanali1/app/{MainActivity,Bridge,SiteAssetHandler}.java
│       ├── assets/web/{index.html,offline.html}   ← index.html با build خودکار همگام می‌شود
│       └── res/… (تم تیره، آیکون تطبیقی، strings fa/en، file_paths، network_security، shortcuts)
├── tools/{prepare-web.py,prepare-icons.py,make-keystore.sh,build-release.sh,assetlinks.sh}
├── store/        ← آیکون ۵۱۲ و منبع بنر برای پنل مارکت‌ها (با prepare-icons.py پر می‌شود)
├── BUILD.md  STORE-GOOGLE.md  STORE-MYKET.md  PRIVACY.md
```

## یک‌بار، از صفر (خلاصه)
```bash
cd android
python3 tools/prepare-web.py && python3 tools/prepare-icons.py   # پوسته + آیکون‌ها
bash tools/make-keystore.sh                                      # کلید امضا (یک‌بار، گم نشود!)
gradle wrapper --gradle-version 8.13                             # فقط اولین بار (اگر gradlew ندارید)
bash tools/build-release.sh                                      # AAB + APK امضاشده
```
سپس `app-release.aab` را در گوگل‌پلی و `app-release.apk` را در مایکت آپلود کنید.

## تنظیم‌هایی که احتمالاً لازم می‌شود
در `gradle.properties`:

| کلید | پیش‌فرض | کی عوضش کنید |
|---|---|---|
| `titanali.appId` | `ir.titanali1.app` | اگر نام بسته را مایکت/پلی به نام دیگری رزرو کرده‌اید (همزمان `res/xml/shortcuts.xml` را هم) |
| `titanali.site` / `titanali.api` | `https://titanali1.ir/` · `…/api.php` | دامنه عوض شد |
| `titanali.appHost` | `app.titanali1.ir` | مبدأ ساختگی پوسته؛ اگر عوض شد، همان را به `appOrigins` در `titanali-config.php` هم اضافه کنید (CORS) |
| `titanali.remoteFirst` | `false` | `true` = همیشه نسخهٔ زندهٔ سایت (تازه‌ترین محتوا، بدون آفلاین) |
| `titanali.versionName` / `versionCode` | خودکار از `index.html` | دستی دست نزنید؛ `prepare-web.py` ست می‌کند (`major*10000+minor*100+patch`) |

## چطور سایت و اپ با هم تازه بمانند
1. سایت را عوض کنید و `bash deploy/publish-latest.sh` بزنید (همان چرخهٔ همیشه).
2. بعدش: `python3 android/tools/prepare-web.py` — کپیِ تازه در `assets/web` و هم‌کالیِ `versionName/versionCode` با نسخهٔ سایت.
3. `bash android/tools/build-release.sh` و آپلود نسخهٔ تازه.
   اگر `prepare-web.py --check` در CI شکست خورد، یعنی اپ از پوستهٔ کهنه ساخته می‌شود.

## حریم خصوصی و داده‌ها
برنامه هیچ permission پرخطر دیگری نمی‌خواهد (نه دوربین، نه مخاطبین، نه موقعیت). پیام‌ها و
نام/شماره در `localStorage` خودِ گوشی می‌مانند و وقتی به `api.php` وصل شوید به هاست سایت
می‌روند. متن آمادهٔ سیاست حریم خصوصی: [PRIVACY.md](PRIVACY.md) — و نسخهٔ قابل‌هاست در
`../privacy.html` (لینک: `https://titanali1.ir/privacy.html`).
