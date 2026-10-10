# انتشار در Google Play (2026) — چک‌لیست تیتانلی

## آنچه همین پروژه از پیش رعایت کرده
| قانون ۲۰۲۶ | وضعیت در این پروژه |
|---|---|
| `targetSdk ≥ 36` (اندروید ۱۶) — برای اپ و به‌روزرسانی جدید از ۳۱ مرداد ۱۴۰۵ (۲۰۲۶/۸/۳۱) | `app/build.gradle`: `targetSdk 36`, `compileSdk 36` |
| فایل نصبی جدید فقط **AAB** | `./gradlew bundleRelease` → `app-release.aab` |
| Play App Signing (کلید آپلود جدا از کلید امضا) | `tools/make-keystore.sh` کلید آپلود را می‌سازد؛ کلید نهایی را گوگل نگه می‌دارد |
| edge-to-edge اجباری در targetSdk 36 (بدون opt-out) | padding از `systemBars + displayCutout` در `MainActivity` |
| predictive back (`onBackPressed` دیگر صدا زده نمی‌شود) | `OnBackPressedCallback` + `android:enableOnBackInvokedCallback="true"` |
| page size ۱۶KB (فقط مربوط به native libs) | کتابخانهٔ native نداریم ✓ |
| حذف نشانۀ `wv` از User-Agent (وگرنه «wrapper» برچسب می‌خورد) | `configureWebView()` |
| بدون permission پرخطر، بدون تبلیغات، بدون پرداخت درون‌برنامه‌ای | مانیفست: `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WRITE_EXTERNAL_STORAGE (≤28)` |
| URL سیاست حریم خصوصی | `https://titanali1.ir/privacy.html` (فایل `privacy.html` ریشهٔ مخزن) |

اگر جایی `targetSdk` پایین ماند: Play Console → اعلان → «Request extension» (تا ۱ آبان ۱۴۰۵) —
که با API 36 این پروژه لازم نمی‌شود.

## یک‌بار: حساب توسعه‌دهنده
1. <https://play.google.com/console> — ۲۵ دلار، حساب بانکی، آدرس، تلفن، احراز هویت.
2. **Create app**: زبان اصلی *English (US)* و بعد افزودن *Persian (Iran)*؛
   نام: `Titanali — Design & Tailoring` (در زبان fa: «تیتانلی — طراحی و دوخت»)،
   Type = App، Free = Yes، Ads = No.
3. *Advanced settings → App verification*: اختیاری؛ با `tools/assetlinks.sh` فعال می‌شود.

## آپلود
```
Release → Production → Create new release → Upload app-release.aab
```
`versionCode 10008 (1.0.8)` را خودش نشان می‌دهد. هشدار `resConfigs` مربوط به محدودکردن زبان‌هاست
(fa/en) و مشکلی ایجاد نمی‌کند.

## فرم‌هایی که باید پر شوند
- **Privacy policy**: `https://titanali1.ir/privacy.html` (متن آماده: [PRIVACY.md](PRIVACY.md)).
- **Ads**: No.
- **Data safety** — پاسخ‌های درست برای همین اپ:
  - *Data collected*: **Yes** — فرم گفتگو نام و شماره تلفن را به هاست سایت می‌فرستد.
  - انواع: `Name`، `Phone number`، `Other user-generated content` (متن پیام)، `App interactions`
    (لایک/دانلود که پیش‌فرض فقط روی دستگاه است).
  - *Encrypted in transit*: **Yes** (HTTPS).
  - *Users can request deletion*: **Yes** — «به سایت یا شمارهٔ کارگاه پیام بدهید؛ `titanali-data/inbox.json` پاک می‌شود.»
  - *Shared with third parties*: **No** — داده فقط روی هاست خودِ کارگاه می‌نشیند؛ بدون آمارساز، بدون تبلیغات.
  - *Deletion instructions URL*: همان `privacy.html`.
- **Content rating (IARC)**: همه «No» → **Everyone**.
- **Target audience**: ۱۳+ (زدن زیر ۱۳ سال، فرم‌های Family Policy را اضافه می‌کند؛ لازم نیست).
- **Category**: Lifestyle یا Shopping.
- **Store listing** (fa + en):
  - Short description (fa، تا ۸۰ نویسه): «طرح‌های دوخت تیتانلی، ثبت سفارش در گفتگو و تماس با کارگاه — آفلاین هم کار می‌کند.»
  - Full description: متن معرفی سایت + این بند:
    «اپ همان سایت تیتانلی است با تفاوت‌های بومی: اجرا بدون اینترنت، ارسال عکس از دوربین برای سفارش،
    دریافت فایل پاسخ کارگاه، میان‌بُر طرح‌ها/گفتگو روی آیکون، اشتراک‌گذاری با گوشی.»
  - Icon 512×512: `store/icon-512.png` ✓ · Feature graphic 1024×512: از `og.png` ریشه برش بزنید (≤1MB).
  - اسکرین‌شات: حداقل ۴ تصویر ۱۰۸۰×۱۹۲۰ از داخل اپ (خانه، گالری، گفتگو با فرم نام/شماره، صفحهٔ
    پاسخ کارگاه). گرفتنشان: `adb shell screencap -p /sdcard/s1.png && adb pull /sdcard/s1.png`.
- **Release notes**: همان یادداشت ریلیز گیت‌هاب (فارسی + انگلیسی).

## حساب فردی تازه: ۱۴ روز تست بسته
برای حساب‌های فردی ساخته‌شده بعد از نوامبر ۲۰۱۹، پیش از Production لازم است:
1. **Internal testing** → آپلود همان AAB → افزودن آزمایشگرها (ایمیل/گروه گوگل).
2. **Closed testing** با حداقل ۱۲ آزمایشگر فعال به مدت ۱۴ روز (یا استفاده از **Open testing** که همان
   نقش را بازی می‌کند و بعد از انتشار به Production منتقل می‌شود).
3. Production → *Promote release*.

## رایج‌ترین دلایل رد شدن اپ‌های WebView — و جواب شما
| ایراد بازبین | کار / جواب |
|---|---|
| “Repackaged website / minimum functionality” | در پاسخ بنویسید: محتوای باندل‌شدهٔ آفلاین، پیوست دوربین و گالری، دریافت فایل با DownloadManager، میان‌بُر launcher، پل اشتراک بومی، نوار وضعیت اتصال. اگر باز هم رد شد، یک قابلیت بومی دیگر اضافه کنید (اعلان محلی برای پاسخ تازه، یا ویجت). |
| “Privacy policy URL invalid” | `privacy.html` باید از بیرون و با HTTPS باز شود (بدون redirect به اینستا). |
| “Blank screen / broken” | بند ۵ `BUILD.md` (CORS) انجام نشده، یا `titanali.api` غلط است. |
| “Data safety form incomplete” | بخش Data safety همین فایل را کلمه‌به‌کلمه پر کنید. |
| “Trademark/name abuse” | در عنوان نام برند دیگری را نیاورید؛ `titanali`/«تیتانلی» کافی است. |

## بعد از انتشار
- لینک: `https://play.google.com/store/apps/details?id=ir.titanali1.app`
- هر بار که سایت عوض شد: `python3 android/tools/prepare-web.py && bash android/tools/build-release.sh`
  و آپلود AAB تازه (versionCode خودکار بالا می‌رود).
- گزارش crash: Play Console → *Android vitals / Google Play Console crash reporting* — چون
  `minifyEnabled true` و `-keepattributes SourceFile,LineNumberTable` در `proguard-rules.pro` است،
  ردیف‌ها خوانا می‌مانند.
