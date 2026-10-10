#!/usr/bin/env bash
# بررسی وضعیت استقرار روی دامنه (فقط خواندنی؛ چیزی نمی‌نویسد).
#   bash deploy/verify-site.sh [https://titanali1.ir]
# متغیرهای اختیاری:  NO_TLS=1  (رد کردن بررسی HTTPS/www — برای موک محلی)
#                    SKIP_DOMAIN=1 (رد کردن بررسی یکی‌بودن دامنه در فایل‌ها)
# داخل GitHub Actions، خلاصه در $GITHUB_STEP_SUMMARY هم نوشته می‌شود.
set -uo pipefail

SITE="${1:-https://titanali1.ir}"
SITE="${SITE%/}/"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
UA="titanali-verify/1.0"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0; warn=0; DIFFS=""
HOST="$(printf '%s' "$SITE" | sed -E 's#https?://##; s#/.*##')"
SUM="${GITHUB_STEP_SUMMARY:-}"

ok()  { echo "  ✓ $1"; pass=$((pass+1)); if [ -n "$SUM" ]; then echo "✓ $1" >>"$SUM"; fi; return 0; }
no()  { echo "  ✗ $1"; fail=$((fail+1)); if [ -n "$SUM" ]; then echo "✗ $1" >>"$SUM"; fi; return 0; }
wa()  { echo "  · $1"; warn=$((warn+1)); if [ -n "$SUM" ]; then echo "· $1" >>"$SUM"; fi; return 0; }
head2() { echo; echo "── $1 ──"; return 0; }

get() {  # GET با دنبال‌کردن ریدایرکت → $TMP/out ; برمی‌گرداند: status<TAB>type<TAB>size
  curl -sS -L -m 25 -A "$UA" --compressed -o "$TMP/out" \
       -w '%{http_code}\t%{content_type}\t%{size_download}' "$1" 2>"$TMP/err" || printf '000\t-\t0'
}
getnoredir() {
  curl -sS -m 25 -A "$UA" -o "$TMP/out" -w '%{http_code}\t%{redirect_url}' "$1" 2>/dev/null || printf '000\t'
}
jget() { # jget <key>  ← JSON روی stdin
  python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
for p in sys.argv[1].split("."):
    d=d.get(p) if isinstance(d,dict) else None
print("" if d is None else (json.dumps(d,ensure_ascii=False) if isinstance(d,(dict,list)) else d))' "$1"
}

echo "بررسی $SITE"

head2 "بک‌اند"
meta="$(get "${SITE}api.php?action=health")"
st="$(printf '%s' "$meta" | cut -f1)"
if [ "$st" != "200" ]; then
  no "api.php?action=health کد $st داد — فایل روی هاست نیست یا PHP خاموش است"
else
  body="$(cat "$TMP/out")"
  if [ "$(printf '%s' "$body" | jget app)" != "titanali" ]; then
    no "api.php JSON نداد (PHP فعال نیست یا فایل نصفه رفته) — پاسخ: $(printf '%s' "$body" | head -c 160)"
  else
    ok "api.php کار می‌کند (نسخهٔ $(printf '%s' "$body" | jget ver)، PHP $(printf '%s' "$body" | jget php))"
    INST="$(printf '%s' "$body" | jget installed)"; NEED="$(printf '%s' "$body" | jget needSetup)"
    WR="$(printf '%s' "$body" | jget writable)"; DD="$(printf '%s' "$body" | jget dataDir)"
    if [ "$WR" = "True" ]; then ok "پوشهٔ داده قابل نوشتن است: $DD"; else no "پوشهٔ داده قابل نوشتن نیست: $DD — مجوز ۷۰۰ با مالکیت کاربر PHP لازم است"; fi
    if [ "$INST" = "True" ]; then
      ok "ادمین سرور ساخته شده (installed=true) — ورود با رمزِ سرور"
    elif [ "$NEED" = "True" ]; then
      no "نصب کامل نشده (needSetup=true) — یک بار: bash deploy/install-api.sh $SITE"
    else
      no "health غیرمنتظره است: $(printf '%s' "$body" | head -c 200)"
    fi
    case "$DD" in *public_html*) wa "داده‌ها داخل public_html است (با .htaccess بسته شده؛ بیرون بردنش اختیاری است)";; esac
    DOM="$(printf '%s' "$body" | jget domain)"
    if [ -n "$DOM" ]; then
      if [ "$DOM" = "$HOST" ]; then ok "TA_DOMAIN = $DOM (قفل دامنه فعال است)"; else no "TA_DOMAIN = $DOM ولی روی $HOST باز شده — در titanali-config.php اصلاح کنید"; fi
    fi
  fi
fi

if [ -z "${SKIP_DOMAIN:-}" ]; then
  head2 "دامنه در فایل‌ها"
  get "${SITE}" >/dev/null; html="$(cat "$TMP/out")"
  if printf '%s' "$html" | grep -q "rel=\"canonical\" href=\"${SITE}\""; then ok "canonical روی $SITE"; else no "canonical با $SITE نمی‌خواند (index.html روی هاست کهنه است؟)"; fi
  if printf '%s' "$html" | grep -q "property=\"og:image\" content=\"${SITE}og.png\""; then ok "og:image درست"; else no "og:image درست نیست"; fi
  if printf '%s' "$html" | grep -q "navigator.serviceWorker"; then ok "سرویس‌ورکر ثبت شده"; else wa "ثبت سرویس‌ورکر در HTML پیدا نشد"; fi

  get "${SITE}site.webmanifest" >/dev/null
  if grep -q "\"id\": *\"${SITE}\"" "$TMP/out"; then ok "site.webmanifest روی $SITE"; else no "idِ منیفست دامنهٔ دیگری دارد (PWA روی دامنهٔ اشتباه نصب می‌شود)"; fi
  get "${SITE}robots.txt" >/dev/null
  if grep -q "Sitemap: ${SITE}sitemap.xml" "$TMP/out"; then ok "robots.txt → sitemap"; else no "خط Sitemap در robots.txt درست نیست"; fi
  get "${SITE}sitemap.xml" >/dev/null
  if grep -q "<loc>${SITE}</loc>" "$TMP/out"; then ok "sitemap.xml → $SITE"; else no "برچسب <loc> در sitemap.xml درست نیست"; fi
fi

head2 "امنیت"
for p in "titanali-data/" "titanali-data/config.json" "titanali-data/content.json" "deploy/" "dist/"; do
  s="$(getnoredir "${SITE}${p}" | cut -f1)"
  case "$s" in
    403|404) ok "بسته است: /$p ($s)";;
    000)     no "پاسخی نگرفتیم: /$p";;
    200)     no "باز و خواندنی است: /$p ← فوری: .htaccess را آپلود کنید";;
    *)       wa "/$p کد $s";;
  esac
done
s="$(getnoredir "${SITE}.htaccess" | cut -f1)"
case "$s" in
  403|404) ok "خودِ .htaccess خوانده نمی‌شود";;
  200)     no ".htaccess متن‌صاف برمی‌گرداند (روی بعضی هاست‌ها طبیعی است ولی باید بسته شود)";;
  *)       wa ".htaccess کد $s داد";;
esac
s="$(getnoredir "${SITE}titanali-config.php" | cut -f1)"
if [ "$s" = "200" ]; then no "titanali-config.php با ۲۰۰ برگشت — نباید محتوایی چاپ کند"; else ok "titanali-config.php قابل خواندن نیست ($s)"; fi

if [ -z "${NO_TLS:-}" ]; then
  head2 "HTTPS و www"
  host="$(printf '%s' "$SITE" | sed -E 's#https?://##; s#/.*##')"
  case "$host" in
    www.*) apex="$(printf '%s' "$host" | sed 's/^www\.//')";;
    *)     apex="www.$host";;
  esac
  h="$(printf '%s' "$SITE" | sed 's#https://#http://#')"
  r="$(getnoredir "$h")"; s="$(printf '%s' "$r" | cut -f1)"; loc="$(printf '%s' "$r" | cut -f2)"
  if [ "$s" = "301" ] || [ "$s" = "302" ] || [ "$s" = "308" ]; then
    case "$loc" in
      https*) ok "http → https ریدایرکت می‌شود ($s)";;
      *)      wa "ریدایرکت هست اما به https نمی‌رود: $loc";;
    esac
  elif [ "$s" = "200" ]; then
    no "http:// بدون ریدایرکت باز می‌شود — در cPanel «Force HTTPS» را روشن کنید"
  else
    wa "http پاسخ نداد ($s)"
  fi
  s="$(getnoredir "https://$apex/" | cut -f1)"
  case "$s" in
    200|301|302|308) ok "نگاشت دوم در دسترس است: $apex ($s)";;
    000)             no "$apex باز نمی‌شود — DNS/SSL این نام را ندارد (در Domains اضافه و AutoSSL بزنید)";;
    *)               wa "$apex کد $s داد";;
  esac
fi

head2 "تازگی فایل‌ها روی هاست (مقایسه با مخزن)"
for f in index.html robots.txt sitemap.xml site.webmanifest sw.js 404.html favicon.svg og.png \
         icon-192.png icon-512.png maskable-512.png apple-touch-icon.png titanali-config.sample.php; do
  if [ ! -f "$REPO/$f" ]; then wa "$f در مخزن نیست"; continue; fi
  get "${SITE}$f" >/dev/null
  a="$(sha256sum "$REPO/$f" | cut -c1-12)"; b="$(sha256sum "$TMP/out" | cut -c1-12)"
  if [ "$a" = "$b" ]; then echo "  = $f"; else echo "  ≠ $f (هاست ${b} | مخزن ${a})"; DIFFS="$DIFFS $f"; fi
done
if [ -n "$DIFFS" ]; then
  no "این فایل‌ها روی هاست با مخزن فرق دارند ← بستهٔ تازه را روی public_html Extract کنید:$DIFFS"
else
  ok "همهٔ فایل‌های بسته با مخزن یکی‌اند ✓"
fi

echo
echo "نتیجه: $pass ✓  /  $fail ✗  /  $warn ·"
if [ -n "$SUM" ]; then printf '\n**نتیجه: %s ✓ / %s ✗ / %s ·**\n' "$pass" "$fail" "$warn" >>"$SUM"; fi
[ "$fail" -eq 0 ]
