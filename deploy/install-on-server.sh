#!/usr/bin/env bash
# =============================================================================
#  نصب titanali روی هاست سی‌پنل — با یک خط، از هر جایی که curl دارد
#
#      curl -fsSL https://raw.githubusercontent.com/titanali1/titanali1/latest/deploy/install-on-server.sh | bash
#
#  چکار می‌کند: ۱) از public_html بکاپ می‌گیرد ۲) بسته را می‌گیرد و checksum را می‌سنجد
#  ۳) فایل‌ها را می‌ریزد و مجوزها را تنظیم می‌کند ۴) (اختیاری) پوشهٔ داده را بیرون از وب می‌برد
#  ۵) ادمین سرور را می‌سازد و با login اثبات می‌کند ۶) گزارش نهایی می‌دهد.
#
#  چیزی پاک نمی‌کند؛ بکاپ تنها راه بازگشت است و آدرسش چاپ می‌شود.
#  متغیرهای اختیاری (پیش از دستور بدهید):
#    SITE=https://titanali1.ir      PUB=$HOME/public_html     REPO=titanali1/titanali1   REF=latest
#    MOVE_DATA=0                    SKIP_INSTALL=1            YES=1       ZIP_FILE=/path/titanali-cpanel.zip
#    TA_ADMIN_USER=admin TA_ADMIN_PASS='…'   (بدوانسرال; اگر نباشد می‌پرسد)
#  روی ماشین خودتان هم برای تمرین کار می‌کند:
#    SITE=http://127.0.0.1:8099/ PUB=$HOME/fakehome/public_html ZIP_FILE=… bash deploy/install-on-server.sh
# =============================================================================
set -uo pipefail

REPO="${REPO:-titanali1/titanali1}"
REF="${REF:-latest}"
RAW="${RAW:-https://raw.githubusercontent.com/$REPO/$REF}"
CDN="${CDN:-https://cdn.jsdelivr.net/gh/$REPO@$REF}"
ZIP_URL="${ZIP_URL:-$RAW/titanali-cpanel.zip}"
SHA_URL="${SHA_URL:-$RAW/titanali-cpanel.zip.sha256}"
SITE="${SITE:-https://titanali1.ir}"; SITE="${SITE%/}"
HOME_DIR="${HOME_DIR:-$HOME}"
PUB="${PUB:-$HOME_DIR/public_html}"
MOVE_DATA="${MOVE_DATA-1}"
YES="${YES:-0}"
pass=0; fail=0; warn=0
TMP="$(mktemp -d 2>/dev/null || echo /tmp/titanali-install.$$)"; mkdir -p "$TMP"; trap 'rm -rf "$TMP"' EXIT

ok()  { echo "  ✓ $1"; pass=$((pass+1)); return 0; }
no()  { echo "  ✗ $1"; fail=$((fail+1)); return 0; }
wa()  { echo "  · $1"; warn=$((warn+1)); return 0; }
hd()  { echo; echo "── $1 ──"; return 0; }
die() { echo "✗ $1" >&2; echo "  (هیچ فایلی تغییر نکرد / بکاپ گرفته شده: ${BAK:-هیچ})" >&2; exit 1; }

JGET='import sys,json
try: d=json.load(sys.stdin)
except Exception: print(""); raise SystemExit
for p in sys.argv[1].split("."):
    d=d.get(p) if isinstance(d,dict) else None
print("" if d is None else d)'
jget() { python3 -c "$JGET" "$1" 2>/dev/null; }

echo "نصب titanali · سایت: $SITE · هدف: $PUB"

# ---------------------------------------------------------------- ۰) پیش‌نیاز
hd "پیش‌نیاز"
command -v curl >/dev/null 2>&1 || die "curl لازم است"
ok "curl هست"
if command -v python3 >/dev/null 2>&1; then HAVE_PY=1; ok "python3 هست (JSON خوانده می‌شود)"; else HAVE_PY=0; wa "python3 نیست؛ پاسخ‌ها خام چاپ می‌شوند"; fi
UNZIP=""
if command -v unzip >/dev/null 2>&1; then UNZIP="unzip -o -q"; elif command -v bsdtar >/dev/null 2>&1; then UNZIP="bsdtar -xqf"; fi
[ -n "$UNZIP" ] || die "unzip (یا bsdtar) لازم است — یا بسته را با File Manager بریزید"
ok "بازکردن زیپ: $UNZIP"
[ -d "$PUB" ] || die "پوشهٔ $PUB پیدا نشد (PUB=… بدهید)"
ok "مقصد هست: $PUB"
if [ ! -w "$PUB" ]; then die "در $PUB نمی‌توان نوشت (مجوز/مالکیت)"; fi
ok "نوشتن در مقصد مجاز است"
SHA1="sha256sum"; command -v sha256sum >/dev/null 2>&1 || { command -v shasum >/dev/null 2>&1 && SHA1="shasum -a 256"; }
ok "راستی‌آزمایی: $SHA1"

# ------------------------------------------------------------------ ۱) بکاپ
hd "بکاپ از نسخهٔ فعلی"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BAK="$HOME_DIR/titanali-backup-$STAMP.tgz"
if [ -n "$(ls -A "$PUB" 2>/dev/null)" ]; then
  if command -v tar >/dev/null 2>&1; then
    if tar -czf "$BAK" -C "$(dirname "$PUB")" "$(basename "$PUB")" 2>/dev/null; then
      ok "بکاپ: $BAK ($(du -h "$BAK" 2>/dev/null | cut -f1))"
      wa "بازگشت: tar -xzf $BAK -C $(dirname "$PUB")"
    else
      rm -f "$BAK"; wa "بکاپ با tar نشد (دسترسی؟) — ادامه می‌دهیم بدون بکاپ"
    fi
  else
    wa "tar نیست؛ بکاپ گرفته نشد"
  fi
else
  wa "public_html خالی است؛ بکاپ لازم نیست"
fi

# ------------------------------------------------------------ ۲) بسته و checksum
hd "دریافت بسته"
if [ -n "${ZIP_FILE:-}" ] && [ -f "$ZIP_FILE" ]; then
  cp "$ZIP_FILE" "$TMP/titanali-cpanel.zip"; ok "از فایل محلی استفاده شد: $ZIP_FILE"
  if [ -f "$ZIP_FILE.sha256" ]; then cp "$ZIP_FILE.sha256" "$TMP/titanali-cpanel.zip.sha256"; ok "کنار فایل محلی، .sha256 هم پیدا شد"; fi
else
  if curl -fsSL -m 90 -o "$TMP/titanali-cpanel.zip" "$ZIP_URL" 2>"$TMP/e"; then ok "بسته از $RAW"
  elif curl -fsSL -m 90 -o "$TMP/titanali-cpanel.zip" "$CDN/titanali-cpanel.zip" 2>"$TMP/e"; then ok "بسته از آیینهٔ CDN ($CDN)"
  else die "بسته دانلود نشد: $(head -c 160 "$TMP/e" 2>/dev/null)"; fi
fi
SZ=$(wc -c < "$TMP/titanali-cpanel.zip" | tr -d ' ')
[ "$SZ" -gt 20000 ] || die "حجم بسته غیرعادی است ($SZ بایت) — دانلود نصفه؟"
ok "حجم: $SZ بایت"
if curl -fsSL -m 30 -o "$TMP/titanali-cpanel.zip.sha256" "$SHA_URL" 2>/dev/null ||
   curl -fsSL -m 30 -o "$TMP/titanali-cpanel.zip.sha256" "$CDN/titanali-cpanel.zip.sha256" 2>/dev/null; then
  GOT="$("$SHA1" "$TMP/titanali-cpanel.zip" | cut -d' ' -f1)"
  WANT="$(cut -d' ' -f1 "$TMP/titanali-cpanel.zip.sha256" | head -1)"
  if [ -n "$WANT" ] && [ "$GOT" = "$WANT" ]; then ok "checksum درست: ${WANT:0:16}…"
  elif [ -n "$WANT" ]; then
    no "checksum نمی‌خواند! wanted ${WANT:0:16}… got ${GOT:0:16}…"
    if [ "$YES" != "1" ]; then die "با YES=1 می‌توانید ادامه دهید (توصیه نمی‌شود)"; fi
    wa "چون YES=1 بود، با بستهٔ تاییدنشده ادامه می‌دهیم"
  fi
else
  wa "فایل .sha256 گیر نیامد؛ راستی‌آزمایی انجام نشد"
fi

# ------------------------------------------------------------------- ۳) ریختن
hd "ریختن فایل‌ها در $PUB"
mkdir -p "$TMP/x"
if ! $UNZIP "$TMP/titanali-cpanel.zip" -d "$TMP/x" >/dev/null 2>&1; then die "بازکردن زیپ نشد"; fi
N=$(find "$TMP/x" -maxdepth 1 -type f | wc -l | tr -d ' ')
[ "$N" -ge 10 ] || die "زیپ فقط $N فایل داشت — بسته خراب است"
ok "$N فایل در بسته"
for f in index.html api.php .htaccess sw.js site.webmanifest 404.html robots.txt sitemap.xml; do
  if [ -f "$TMP/x/$f" ]; then cp -f "$TMP/x/$f" "$PUB/$f"; else wa "$f در بسته نیست"; fi
done
for f in og.png icon-192.png icon-512.png maskable-512.png apple-touch-icon.png favicon.svg titanali-config.sample.php titanali-install.php; do
  [ -f "$TMP/x/$f" ] && cp -f "$TMP/x/$f" "$PUB/$f"
done
chmod 644 "$PUB"/*.html "$PUB"/*.php "$PUB"/*.js "$PUB"/*.txt "$PUB"/*.xml "$PUB"/*.webmanifest "$PUB"/*.svg "$PUB"/*.png 2>/dev/null
chmod 644 "$PUB/.htaccess" 2>/dev/null
ok "مجوزها: فایل‌ها ۶۴۴"
[ -f "$PUB/titanali-config.php" ] && wa "titanali-config.php از قبل هست؛ دست نخورد"
ls "$PUB/titanali-data" >/dev/null 2>&1 && ok "داده‌های پیشین در titanali-data دست‌نخورده ماند"

# --------------------------------------------------- ۴) بردن داده بیرون از وب
if [ "$MOVE_DATA" = "1" ]; then
  hd "پوشهٔ داده بیرون از public_html"
  DATA="$HOME_DIR/titanali-data"
  case "$(basename "$PUB")" in public_html|public_ftp|htdocs|www|httpdocs) HOME_OF_PUB="$(dirname "$PUB")";; *) HOME_OF_PUB="$HOME_DIR";; esac
  DATA="$HOME_OF_PUB/titanali-data"
  if mkdir -p "$DATA" 2>/dev/null; then
    chmod 700 "$DATA" 2>/dev/null
    ok "پوشه: $DATA (۷۰۰)"
    if [ -d "$PUB/titanali-data" ]; then
      n=0; for f in "$PUB/titanali-data"/*.json; do [ -f "$f" ] && cp -n "$f" "$DATA/" && n=$((n+1)); done
      [ -d "$PUB/titanali-data/uploads" ] && cp -rn "$PUB/titanali-data/uploads" "$DATA/" 2>/dev/null
      wa "$n فایل json منتقل (کپی) شد؛ نسخهٔ داخل وب پاک نشد"
    fi
    printf 'Require all denied\nDeny from all\n' > "$DATA/.htaccess" 2>/dev/null
    if [ ! -f "$PUB/titanali-config.php" ]; then
      printf '<?php\n/** ساخته‌شده توسط install-on-server.sh در %s */\nreturn array(\n    %s => %s,\n);\n' "$(date -u '+%Y-%m-%d %H:%M')" "'dataDir'" "'$DATA'" > "$PUB/titanali-config.php" \
        && chmod 600 "$PUB/titanali-config.php" && ok "titanali-config.php نوشته شد" \
        || no "نوشتن titanali-config.php نشد"
    else
      wa "titanali-config.php هست؛ تغییر داده نشد (برای جابه‌جایی، dataDir را دستی به $DATA تغییر دهید)"
    fi
    if [ -f "$PUB/titanali-config.php" ] && grep -q "$DATA" "$PUB/titanali-config.php" 2>/dev/null; then
      wa "اگر در health بعدی writable:false دیدید، هاست open_basedir را محدود کرده: titanali-config.php را پاک کنید"
    fi
  else
    no "ساخت $DATA نشد (احتمالاً open_basedir) — داده همان‌جا که هست می‌ماند"
  fi
fi

# ------------------------------------------------------------------ ۵) سلامت
hd "بررسی بک‌اند"
H="$(curl -sS -L -m 30 "$SITE/api.php?action=health" 2>&1)" || die "api.php پاسخ نداد: $H"
if [ "$HAVE_PY" = "1" ]; then
  APP="$(printf '%s' "$H" | jget app)"; INST="$(printf '%s' "$H" | jget installed)"
  NEED="$(printf '%s' "$H" | jget needSetup)"; WR="$(printf '%s' "$H" | jget writable)"
  DD="$(printf '%s' "$H" | jget dataDir)"; PHPV="$(printf '%s' "$H" | jget php)"
  if [ "$APP" != "titanali" ]; then
    die "api.php JSON نداد — پاسخ: $(printf '%s' "$H" | head -c 220)"
  fi
  ok "api.php کار می‌کند (PHP $PHPV · rev $(printf '%s' "$H" | jget rev))"
  [ "$WR" = "True" ] && ok "پوشهٔ داده قابل نوشتن است: $DD" || no "پوشهٔ داده قابل نوشتن نیست: $DD — chmod 700 و مالکیت کاربر PHP"
else
  printf '%s\n' "$H" | head -c 400; echo
  INST=""; NEED=""; case "$H" in *'"installed":true'*) INST=True;; esac; case "$H" in *'"needSetup":true'*) NEED=True;; esac
fi

# -------------------------------------------------------------- ۶) ادمین سرور
hd "ادمین سرور"
if [ "${SKIP_INSTALL:-0}" = "1" ]; then
  wa "SKIP_INSTALL=1 — ساخت ادمین انجام نشد"
elif [ "$INST" = "True" ]; then
  ok "ادمین سرور از قبل ساخته شده — چیزی انجام نشد (برای رمز تازه: پنل → تب «ادمین‌ها» → … → «رمز ادمین‌ها روی سرور»)"
else
  U="${TA_ADMIN_USER:-}"; P="${TA_ADMIN_PASS:-}"
  TTY=0; if [ -t 0 ]; then TTY=1; elif [ -e /dev/tty ]; then TTY=2; fi   # ۱=پایانه، ۲=لوله‌شده (curl | bash)
  if [ -z "$U" ] && [ "$TTY" != "0" ]; then
    if [ "$TTY" = "1" ]; then read -r -p "  نام کاربری (پیش‌فرض admin): " U; else read -r -p "  نام کاربری (پیش‌فرض admin): " U </dev/tty; fi
  fi
  U="${U:-admin}"
  P2=""
  if [ -z "$P" ] && [ "$TTY" != "0" ]; then
    if [ "$TTY" = "1" ]; then read -r -s -p "  رمز (۱۲+ نویسه، دیده نمی‌شود): " P; echo; read -r -s -p "  تکرار رمز: " P2; echo
    else read -r -s -p "  رمز (۱۲+ نویسه، دیده نمی‌شود): " P </dev/tty; echo; read -r -s -p "  تکرار رمز: " P2 </dev/tty; echo; fi
  fi
  if [ -z "$P" ]; then
    wa "رمز داده نشد؛ نصب را خودتان انجام دهید: از مرورگر، تب «همگام‌سازی سرور» — یا با TA_ADMIN_PASS دوباره اجرا کنید"
  else
    PBAD=0
    printf '%s' "$P" | grep -qE '^.{12,}$' || { no "رمز کمتر از ۱۲ نویسه است (سرور ۸ می‌خواهد)"; PBAD=1; }
    if [ -n "${P2:-}" ] && [ "$P" != "$P2" ]; then no "دو بارِ رمز یکی نبود"; PBAD=1; fi
    if [ "$PBAD" != "0" ]; then
      wa "به دلیل خطای رمز، install نفرستاده شد"
    else
      NM="${TA_ADMIN_NAME:-ادمین اصلی}"
      BODY="$(U="$U" P="$P" NM="$NM" python3 -c 'import json,os;print(json.dumps({"u":os.environ["U"],"p":os.environ["P"],"name":os.environ["NM"]}))' 2>/dev/null)"
      if [ -z "$BODY" ]; then
        BODY="{\"u\":\"$U\",\"p\":\"$P\",\"name\":\"$NM\"}"
        wa "JSON بدون python ساخته شد (اگر رمزِ شما \" یا \\ دارد، از TA_ADMIN_PASSِ ساده‌تر استفاده کنید)"
      fi
      R="$(printf '%s' "$BODY" | curl -sS -m 60 -H 'Content-Type: application/json' --data-binary @- "$SITE/api.php?action=install" 2>&1)"
      if [ "$HAVE_PY" = "1" ] && [ "$(printf '%s' "$R" | jget ok)" = "True" ]; then
        ok "ادمین سرور ساخته شد ($U · rev $(printf '%s' "$R" | jget rev))"
        LB="$(U="$U" P="$P" python3 -c 'import json,os;print(json.dumps({"u":os.environ["U"],"p":os.environ["P"]}))' 2>/dev/null)"
        if [ -n "$LB" ]; then
          L="$(printf '%s' "$LB" | curl -sS -m 30 -H 'Content-Type: application/json' --data-binary @- "$SITE/api.php?action=login" 2>&1)"
          if [ "$(printf '%s' "$L" | jget ok)" = "True" ]; then ok "ورود با همین رمز تست شد ✓ (نشست ۱۲ ساعته)"
          else wa "تست login کد دیگری داد ($(printf '%s' "$L" | jget error)) — اگر «۱۰ دقیقه صبر کنید» بود فقط محدودیت تلاش است"; fi
        else
          wa "تست login انجام نشد (python3 برای ساخت JSON لازم است)"
        fi
      else
        no "install نپذیرفت: $(printf '%s' "$R" | head -c 260)"
      fi
    fi
  fi
fi

# ------------------------------------------------------------- ۷) گزارش پایانی
hd "گزارش"
H2="$(curl -sS -m 30 "$SITE/api.php?action=health" 2>&1)"
if [ "$HAVE_PY" = "1" ]; then
  [ "$(printf '%s' "$H2" | jget installed)" = "True" ] && ok "health: installed=true ✓" || wa "health: هنوز installed=false (نصب ادمین لازم است)"
  printf '   dataDir = %s · writable = %s · php = %s · rev = %s\n' "$(printf '%s' "$H2" | jget dataDir)" "$(printf '%s' "$H2" | jget writable)" "$(printf '%s' "$H2" | jget php)" "$(printf '%s' "$H2" | jget rev)"
fi
if [ -f "$PUB/titanali-install.php" ]; then
  wa "نصب‌کنندهٔ وب هنوز سر جایش است: اگر با همین اسکریپت نصب کردید، پاکش کنید →  rm $PUB/titanali-install.php"
fi
echo
echo "نتیجه: $pass ✓ / $fail ✗ / $warn ·"
[ "$fail" -eq 0 ] || { echo "· اگر لازم شد بازگردید: tar -xzf ${BAK:-?} -C $(dirname "$PUB")"; exit 1; }
echo "قدم بعدی: در مرورگر $SITE را باز کنید → روی عنوان «تیتانلی» کلیک کنید → رمز همین‌جا → تب «همگام‌سازی سرور» → «⬆ فرستادن محتوا به سرور»."
echo "و برای تازه‌ماندن نسخه در PWA: در sw.js عدد V را بالا ببرید و یک‌بار F5."
