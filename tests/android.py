#!/usr/bin/env python3
"""بررسی سازگاری پوستهٔ اندروید با سایت (بی‌نیاز از Android SDK).

   python3 tests/android.py

مطمئن می‌شود که: فایل‌های پروژه جا نیفتاده باشند، assets با index.html هم‌زمان باشد،
نسخهٔ اپ از نسخهٔ سایت بیاید، مانیفست/گریدل/منابع XMLها خوش‌ساخت و مطابق الزامات ۲۰۲۶
گوگل‌پلی (targetSdk 36، AAB، edge-to-edge، بدون wv) و مایکت (targetSdk ≥ 34) باشند،
CORS سرور برای مبدأ اپ باز باشد و راهنماهای مارکت‌ها موجود بمانند.
"""
import os, re, struct, sys, hashlib, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AND = ROOT / 'android'
MAIN = AND / 'app/src/main'
JAVA = MAIN / 'java/ir/titanali1/app'
RES = MAIN / 'res'

n_pass = n_fail = 0
def A(name, cond):
    global n_pass, n_fail
    if cond: n_pass += 1; print('  ✓ ' + name)
    else: n_fail += 1; print('  ✗ ' + name)
    return bool(cond)

def read(p):
    try: return Path(p).read_text(encoding='utf-8')
    except Exception: return ''
def rb(p):
    try: return Path(p).read_bytes()
    except Exception: return b''

# ───────── ۱) فایل‌های لازم ─────────
FILES = ['settings.gradle','build.gradle','gradle.properties','.gitignore',
         'app/build.gradle','app/proguard-rules.pro','gradle/wrapper/gradle-wrapper.properties',
         'tools/prepare-web.py','tools/prepare-icons.py','tools/make-keystore.sh',
         'tools/build-release.sh','tools/assetlinks.sh',
         'README.md','BUILD.md','STORE-GOOGLE.md','STORE-MYKET.md','PRIVACY.md',
         'app/src/main/AndroidManifest.xml',
         'app/src/main/java/ir/titanali1/app/MainActivity.java',
         'app/src/main/java/ir/titanali1/app/Bridge.java',
         'app/src/main/java/ir/titanali1/app/SiteAssetHandler.java',
         'app/src/main/assets/web/index.html','app/src/main/assets/web/offline.html',
         'app/src/main/res/layout/activity_main.xml',
         'app/src/main/res/values/strings.xml','app/src/main/res/values-en/strings.xml',
         'app/src/main/res/values/colors.xml','app/src/main/res/values/themes.xml',
         'app/src/main/res/xml/file_paths.xml','app/src/main/res/xml/network_security.xml',
         'app/src/main/res/xml/shortcuts.xml','app/src/main/res/xml/locales_config.xml',
         'app/src/main/res/xml/data_extraction_rules.xml',
         'app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
         'app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
         'app/src/main/res/drawable-nodpi/ic_launcher_fg.png',
         'store/icon-512.png']
missing = [f for f in FILES if not (AND / f).is_file()]
A('همهٔ %d فایل پروژهٔ اندروید موجود است' % len(FILES), not missing)
if missing: print('    ↳ کم است:', ', '.join(missing[:6]))

# ───────── ۲) هم‌کالی پوسته و نسخه‌ها ─────────
site = read(ROOT / 'index.html')
asset = read(MAIN / 'assets/web/index.html')
def sha(t): return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]
A('assets/web/index.html با index.html سایت هم‌زمان است',
  bool(asset) and sha(site) == sha(asset))
if asset and sha(site) != sha(asset):
    print('    ↳ سایت %s · پوسته %s → python3 android/tools/prepare-web.py' % (sha(site), sha(asset)))

mver = re.search(r"window\.titanali=\{ver:'([\d.]+)'", site)
ver = mver.group(1) if mver else ''
gp = {}
for line in read(AND / 'gradle.properties').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k, v = line.split('=', 1); gp[k.strip()] = v.strip()
A('versionName اپ = نسخهٔ سایت (%s)' % (ver or '؟'), gp.get('titanali.versionName') == ver)
parts = [int(x) for x in (ver.split('.') + ['0','0','0'])[:3]]
want_code = parts[0]*10000 + parts[1]*100 + parts[2]
A('versionCode از فرمول major*10000+minor*100+patch می‌آید (%d)' % want_code,
  gp.get('titanali.versionCode') == str(want_code))
A('شناسهٔ بسته ست شده', bool(re.match(r'^[a-z][\w.]*$', gp.get('titanali.appId',''))))
A('آدرس سایت و api در gradle.properties https است',
  gp.get('titanali.site','').startswith('https://') and gp.get('titanali.api','').startswith('https://'))
A('مبدأ اپ (appHost) ست شده', bool(gp.get('titanali.appHost')))
A('پیش‌فرض آفلاین‌اول است (remoteFirst=false)', gp.get('titanali.remoteFirst','false') == 'false')

bg = read(AND / 'app/build.gradle')
A('compileSdk/targetSdk = 36 (الزام گوگل‌پلی ۱۴۰۵)', 'compileSdk 36' in bg and 'targetSdk 36' in bg)
A('minSdk = 24', re.search(r'minSdk\s+24', bg) is not None)
A('R8/Shrinker در release روشن است', 'minifyEnabled true' in bg and 'shrinkResources true' in bg)
A('buildConfig روشن است', 'buildConfig true' in bg)
A('buildConfigField های SITE/API/APP_HOST ساخته می‌شوند',
  all(x in bg for x in ('SITE_URL','API_URL','APP_HOST','REMOTE_FIRST')))
A('task همگام‌سازی پوسته به preBuild وصل است',
  'syncSiteAssets' in bg and "tasks.named('preBuild')" in bg)
A('امضا از keystore.properties و rootProject.file خوانده می‌شود',
  'keystore.properties' in bg and 'rootProject.file' in bg)
A('وابستگی‌ها فقط AndroidX (بی‌نیاز از گوگل‌سرویس → داخل ایران کار می‌کند)',
  'com.google.android.gms' not in bg and 'firebase' not in bg.lower()
  and 'androidx.appcompat' in bg and 'androidx.webkit' in bg)

root_g = read(AND / 'build.gradle')
A('نسخهٔ AGP از gradle.properties خوانده می‌شود', '$agpVersion' in root_g and 'agpVersion' in gp)
A('مخزن‌ها google + mavenCentral هستند', 'google()' in read(AND / 'settings.gradle') and 'mavenCentral()' in read(AND / 'settings.gradle'))
wr = read(AND / 'gradle/wrapper/gradle-wrapper.properties')
A('wrapper به Gradle ≥ 8.13 اشاره می‌کند', bool(re.search(r'gradle-(8\.(1[3-9]|[2-9]\d)|[9-9]\d)', wr)))
A('AndroidX در gradle.properties فعال است', gp.get('android.useAndroidX') == 'true')

# ───────── ۳) مانیفست ─────────
man = read(MAIN / 'AndroidManifest.xml')
def perms(t): return set(re.findall(r'uses-permission[^>]*android:name="([^"]+)"', t))
ok_perms = {'android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.VIBRATE'}
got = perms(man)
A('permissionها حداقلی‌اند (فهرست مجاز)', got <= (ok_perms | {'android.permission.WRITE_EXTERNAL_STORAGE'}))
A('هیچ permission پرخطوری نیست (دوربین/میکروفون/موقعیت/مخاطب/پیامک)',
  not (got & {'android.permission.CAMERA','android.permission.RECORD_AUDIO','android.permission.ACCESS_FINE_LOCATION',
              'android.permission.READ_CONTACTS','android.permission.SEND_SMS','android.permission.READ_EXTERNAL_STORAGE'}))
A('WRITE_EXTERNAL_STORAGE فقط تا API 28', 'maxSdkVersion="28"' in man)
A('allowBackup خاموش (پیام‌ها به بکاپ ابری نرود)', 'android:allowBackup="false"' in man)
A('dataExtractionRules وصل است', 'dataExtractionRules="@xml/data_extraction_rules"' in man)
A('usesCleartextTraffic=false + networkSecurityConfig', 'usesCleartextTraffic="false"' in man and 'networkSecurityConfig="@xml/network_security"' in man)
A('پشتیبانی از predictive back', 'enableOnBackInvokedCallback="true"' in man)
A('launcher activity تعریف شده و exported است',
  'android:name=".MainActivity"' in man and 'android.intent.action.MAIN' in man and 'android.intent.category.LAUNCHER' in man)
A('configChanges تا چرخش صفحه صفحه reload نشود',
  'configChanges=' in man and 'orientation|screenSize' in man)
A('FileProvider برای پیوست دوربین تعریف شده', 'FileProvider' in man and '${applicationId}.fileprovider' in man)
A('intent-filter لینک‌های سایت (با آدرس سایت یکی است)',
  ('android:host="%s"' % re.sub(r'^https?://', '', gp.get('titanali.site','')).strip('/')) in man)
A('میان‌بُرها وصل‌اند', 'android.app.shortcuts' in man)
A('autoVerify پیش‌فرض خاموش (بدون assetlinks ایراد نگیرد)', 'android:autoVerify="false"' in man)

# ───────── ۴) خوش‌ساختی XMLها ─────────
bad = []
for p in sorted(MAIN.rglob('*.xml')):
    try: ET.fromstring(p.read_bytes())
    except Exception as e: bad.append('%s: %s' % (p.name, e))
A('همهٔ فایل‌های XML خوش‌ساخت‌اند (%d)' % len(list(MAIN.rglob('*.xml'))), not bad)
for b in bad[:4]: print('    ↳', b)

# ───────── ۵) آیکون‌ها ─────────
def png_ok(p):
    b = rb(p)
    if len(b) < 24 or b[:8] != b'\x89PNG\r\n\x1a\n': return False
    w, h = struct.unpack('>II', b[16:24])
    return w == h and w >= 96
d = [png_ok(RES / ('mipmap-'+s) / 'ic_launcher.png') and png_ok(RES / ('mipmap-'+s) / 'ic_launcher_round.png')
     for s in ('mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi')]
A('آیکون‌های mipmap در ۵ چگالی موجود و مربعی‌اند', all(d))
A('لایهٔ foreground آیکون تطبیقی موجود است', png_ok(RES / 'drawable-nodpi/ic_launcher_fg.png'))
A('آیکون ۵۱۲ برای مارکت‌ها آماده است', png_ok(AND / 'store/icon-512.png'))
A('ic_launcher.xml به foreground و background درست اشاره می‌کند',
  'ic_launcher_fg' in read(RES / 'mipmap-anydpi-v26/ic_launcher.xml') and 'ic_launcher_background' in read(RES / 'mipmap-anydpi-v26/ic_launcher.xml'))
sh = read(RES / 'xml/shortcuts.xml')
A('shortcuts.xml → بستهٔ درست و میان‌بُر طرح‌ها/گفتگو',
  gp.get('titanali.appId','') in sh and '#gallery' in sh and '#chat' in sh)
ns = read(RES / 'xml/network_security.xml')
A('شبکه: پیش‌فرض بی‌رمز و فقط localhost ساده است',
  'cleartextTrafficPermitted="false"' in ns and ns.count('cleartextTrafficPermitted="true"') == 1)

# ───────── ۶) کد جاوا ─────────
ma = read(JAVA / 'MainActivity.java'); br = read(JAVA / 'Bridge.java'); sa = read(JAVA / 'SiteAssetHandler.java')
A('JS + DOM storage فعال (localStorage سایت همان‌جا می‌ماند)',
  'setJavaScriptEnabled(true)' in ma and 'setDomStorageEnabled(true)' in ma)
A('فایل‌محور بستن: allowFileAccess=false', 'setAllowFileAccess(false)' in ma)
A('diagnostics فقط در debug', 'setWebContentsDebuggingEnabled(BuildConfig.DEBUG)' in ma)
A('«; wv» از User-Agent حذف می‌شود (سیاست گوگل‌پلی)', 'replace("; wv", "")' in ma)
A('پل بومی با نام TitanaliApp اضافه می‌شود', 'addJavascriptInterface(new Bridge(this), "TitanaliApp")' in ma)
A('insetها (نوار وضعیت + cutout) اعمال می‌شوند', 'systemBars()' in ma and 'displayCutout()' in ma and 'setPadding' in ma)
A('بازگشت: اول تاریخچه، بعد «دو ضربه برای خروج»', 'web.canGoBack()' in ma and 'R.string.back_again' in ma)
A('انتخاب فایل + دوربین (onShowFileChooser)', 'onShowFileChooser' in ma and 'MediaStore.ACTION_IMAGE_CAPTURE' in ma)
A('لینک خارجی به مرورگر/برنامهٔ خودش می‌رود', 'shouldOverrideUrlLoading' in ma and 'Intent.ACTION_VIEW' in ma)
A('دریافت فایل با DownloadManager و پشتیبانی dataURL', 'DownloadManager' in ma and 'saveDataUrl' in ma)
A('صفحهٔ آفلاین + نوار اتصال', 'offline.html' in ma and 'R.string.offline_note' in ma and 'isOnline()' in ma)
A('pause/resume برای باتری', 'web.onPause()' in ma and 'web.pauseTimers()' in ma)
A('ذخیرهٔ حالت WebView بین چرخش/بازیابی', 'web.saveState(outState)' in ma and 'web.restoreState(' in ma)
def strip_code(t):
    out=[];i=0;n=len(t)
    while i<n:
        c=t[i]
        if c in '"\'':
            q=c;i+=1
            while i<n and t[i]!=q:
                if t[i]=='\\': i+=1
                i+=1
            i+=1;continue
        if t.startswith('//',i):
            while i<n and t[i]!='\n': i+=1
            continue
        if t.startswith('/*',i):
            j=t.find('*/',i+2); i=n if j<0 else j+2; continue
        out.append(c);i+=1
    return ''.join(out)
bal=True
for src in (ma,br,sa):
    b=strip_code(src)
    bal = bal and b.count('{')==b.count('}') and b.count('(')==b.count(')')
A('توازنی {} و () در سه فایل جاوا', bal)
A('Bridge فقط @JavascriptInterface های محدود دارد', br.count('@JavascriptInterface')>=5 and 'MAX_TEXT' in br)
A('Bridge لینک غیر http/mailto/tel را رد می‌کند', '"http://' in br and '"mailto:"' in br and '"tel:"' in br)
A('asset handler «..» را رد می‌کند (راهی به بیرون از assets نیست)', 'contains("..")' in sa)
A('اسکریپت تنظیمات به HTML تزریق می‌شود (TITANALI_API/SITE/APP)',
  'TITANALI_API' in sa and 'TITANALI_SITE' in sa and 'TITANALI_APP' in sa and '</head>' in sa)
A('پروگارد پل JS را نگه می‌دارد', 'JavascriptInterface' in read(AND / 'app/proguard-rules.pro'))

# ───────── ۷) اتصال امن به سرور ─────────
api = read(ROOT / 'api.php')
A('api.php: هلپر مبدأ مجاز CORS', 'function ta_origin_ok()' in api and 'appOrigins' in api)
A('api.php: هدرها + پاسخ OPTIONS', "Access-Control-Allow-Headers: Content-Type, X-TA-Token" in api and '204' in api)
A('api.php: ta_cors() پیش از مسیرها صدا زده می‌شود', api.find('ta_cors();') > api.find("$ACTION ="))
cfgs = read(ROOT / 'titanali-config.sample.php') + read(ROOT / 'deploy/files/titanali-config.sample.php')
A('هر دو نمونهٔ config کلید appOrigins را دارند', cfgs.count("'appOrigins'") == 2)
A('سایت: apiPath از window.TITANALI_API پیروی می‌کند', 'window.TITANALI_API' in site and 'function apiUrl(u)' in site)

# ───────── ۸) پوسته و صفحهٔ آفلاین ─────────
A('assets/web/index.html همان فایل سایت است (نه نسخهٔ کوتاه‌شده)', 'window.titanali={ver:' in asset)
ofl = read(MAIN / 'assets/web/offline.html')
A('صفحهٔ آفلاین فارسی است و دکمهٔ تلاش دوباره دارد',
  ('اتصال' in ofl or 'آفلاین' in ofl) and 'تلاش دوباره' in ofl and 'index.html' in ofl)
priv = read(ROOT / 'privacy.html')
A('privacy.html در ریشه هست و سیاست حذف را می‌گوید', 'حریم خصوصی' in priv and 'پاک' in priv and 'HTTPS' in priv)
A('privacy.html در بستهٔ سی‌پنل هست', "'privacy.html'" in read(ROOT / 'deploy/make-cpanel.py'))

# ───────── ۹) راهنماها ─────────
rd = read(AND / 'README.md'); bd = read(AND / 'BUILD.md'); gg = read(AND / 'STORE-GOOGLE.md'); mk = read(AND / 'STORE-MYKET.md'); pv = read(AND / 'PRIVACY.md')
A('راهنمای build: سه گام (پوسته → کلید → build) پوشش داده', all(x in bd for x in ('prepare-web.py','make-keystore.sh','build-release.sh','CORS')))
A('STORE-GOOGLE به targetSdk 36 و AAB و Data safety اشاره می‌کند',
  '36' in gg and 'AAB' in gg and 'Data safety' in gg)
A('STORE-MYKET الزام targetSdk ۳۴ و آیکون ۵۱۲ را یادآوری می‌کند', '34' in mk and '۵۱۲' in mk)
A('PRIVACY.md پاسخ‌های فرم مارکت‌ها و مسیر حذف را دارد', 'Data safety' in pv and ('حذف' in pv or 'deletion' in pv.lower()))
A('README اندروید، جدول فایل‌ها و طرز استفاده را دارد', 'app/' in rd and 'gradle.properties' in rd)
A('README سایت، بخش اپلیکیشن اندروید دارد', 'اپلیکیشن اندروید' in read(ROOT / 'README.md'))
A('اسکریپت‌های tools اجراشدنی‌اند (x)',
  all(os.access(AND / ('tools/'+f), os.X_OK) for f in ('prepare-web.py','prepare-icons.py','build-release.sh','make-keystore.sh','assetlinks.sh')))
A('shell scriptها با bash -n سالم‌اند',
  all(os.system('bash -n %s >/dev/null 2>&1' % (AND / ('tools/'+f))) == 0
      for f in ('build-release.sh','make-keystore.sh','assetlinks.sh')))
A('python tools/prepare-web.py --check موفق است',
  os.system('cd %s && python3 tools/prepare-web.py --check >/dev/null 2>&1' % AND) == 0)
A('keystore و خروجی‌ها در .gitignore هستند',
  all(x in read(AND / '.gitignore') for x in ('keystore.properties','*.jks','*.aab','*.apk')))
A('هیچ فایل امضایی داخل مخزن نمانده', not list(AND.glob('*.jks')) and not list(AND.glob('*.keystore')))

print('\nRESULT pass=%d fail=%d' % (n_pass, n_fail))
sys.exit(1 if n_fail else 0)
