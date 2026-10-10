#!/usr/bin/env bash
# فعال‌سازی بک‌اند روی دامنه: ساختن ادمین سرور با action=install (فقط تا وقتی نصب نشده).
#   TA_ADMIN_USER=admin TA_ADMIN_PASS='…' bash deploy/install-api.sh [https://titanali1.ir]
# رمز فقط از محیط می‌آید: در آرگومان خط فرمان نمی‌نشیند و در لاگ چاپ نمی‌شود.
set -uo pipefail

SITE="${1:-https://titanali1.ir}"
SITE="${SITE%/}/"
API="${SITE}api.php"
UA="titanali-install/1.0"
SUM="${GITHUB_STEP_SUMMARY:-}"

# نکته: آخرهر تابع return 0 است؛ وگرنه در `… && ok … || die …` اشتباه اعلام شکست می‌دهد.
die() { echo "✗ $1" >&2; if [ -n "$SUM" ]; then echo "✗ $1" >>"$SUM"; fi; exit 1; }
say() { echo "· $1"; if [ -n "$SUM" ]; then echo "· $1" >>"$SUM"; fi; return 0; }
ok()  { echo "✓ $1"; if [ -n "$SUM" ]; then echo "✓ $1" >>"$SUM"; fi; return 0; }

jget() {
  python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
k=sys.argv[1].split(".")
for p in k:
    d=d.get(p) if isinstance(d,dict) else None
print("" if d is None else (json.dumps(d,ensure_ascii=False) if isinstance(d,(dict,list)) else d))' "$1"
}

post() { # post <action> <json-body>  → بدنهٔ پاسخ در $RESP ، کد در $CODE
  RESP="$(printf '%s' "$2" | curl -sS -m 40 -A "$UA" -H 'Content-Type: application/json' \
            -w '\n@@%{http_code}' --data-binary @- "$API?action=$1" 2>&1)"
  CODE="$(printf '%s' "$RESP" | tail -n1 | sed 's/^@@//')"
  RESP="$(printf '%s' "$RESP" | sed '$d')"
}

echo "فعال‌سازی $SITE"

# ۱) سلامت و نیاز به نصب
H="$(curl -sS -L -m 30 -A "$UA" "$API?action=health" 2>&1)" || die "api.php پاسخ نداد: $H"
APP="$(printf '%s' "$H" | jget app)"
[ "$APP" = "titanali" ] || die "api.php روی $SITE نصب/فعال نیست (پاسخ: $(printf '%s' "$H" | head -c 200))"
VER="$(printf '%s' "$H" | jget ver)"; INST="$(printf '%s' "$H" | jget installed)"; NEED="$(printf '%s' "$H" | jget needSetup)"
WR="$(printf '%s' "$H" | jget writable)"; DD="$(printf '%s' "$H" | jget dataDir)"
say "سرور: نسخهٔ $VER · PHP $(printf '%s' "$H" | jget php) · پوشهٔ داده: $DD"
[ "$WR" = "True" ] || die "پوشهٔ داده قابل نوشتن نیست ($DD) — مجوز ۷۰۰ با مالکیت کاربر PHP لازم است"
if [ "$INST" = "True" ]; then
  ok "روی این دامنه از قبل ادمین ساخته شده — چیزی انجام نشد (برای رمز تازه، از پنل: تب «همگام‌سازی سرور»)"
  exit 0
fi
[ "$NEED" = "True" ] || die "health می‌گوید needSetup=false ولی installed=false — وضعیت داده‌ها را بررسی کنید"

# ۲) نام کاربری/رمز از محیط
[ -n "${TA_ADMIN_USER:-}" ] || die "TA_ADMIN_USER تنظیم نشده — در Actions: gh secret set TA_ADMIN_USER"
if [ -z "${TA_ADMIN_PASS:-}" ]; then die "TA_ADMIN_PASS تنظیم نشده — در Actions: gh secret set TA_ADMIN_PASS"; fi
printf '%s' "$TA_ADMIN_USER" | grep -Eq '^[A-Za-z0-9_.-]{3,32}$' || die "نام کاربری باید ۳ تا ۳۲ نویسهٔ لاتین (بدون فاصله) باشد"
[ "${#TA_ADMIN_PASS}" -ge 12 ] || die "رمز برای این اسکریپت حداقل ۱۲ کاراکتر باشد (سرور ۸ می‌خواهد)"

BODY="$(python3 -c 'import json,os,sys
print(json.dumps({"u":os.environ["TA_ADMIN_USER"],
                  "p":os.environ["TA_ADMIN_PASS"],
                  "name":os.environ.get("TA_ADMIN_NAME") or "ادمین سرور"}))')" || die "ساخت JSON نشد"
say "ارسال install (نام کاربری: $TA_ADMIN_USER)"
post install "$BODY"
[ "$CODE" = "200" ] || die "install رد شد (HTTP $CODE): $(printf '%s' "$RESP" | head -c 300)"
TOK="$(printf '%s' "$RESP" | jget token)"
[ -n "$TOK" ] || die "پاسخ install توکن نداشت: $(printf '%s' "$RESP" | head -c 200)"
ok "ادمین سرور ساخته شد · rev $(printf '%s' "$RESP" | jget rev) · توکن ${#TOK} نویسه‌ای صادر شد (در لاگ چاپ نمی‌شود)"

# ۳) اثبات اینکه ورود با همین رمز کار می‌کند
BODY2="$(python3 -c 'import json,os;print(json.dumps({"u":os.environ["TA_ADMIN_USER"],"p":os.environ["TA_ADMIN_PASS"]}))')"
post login "$BODY2"
if [ "$CODE" = "200" ]; then
  ok "ورود با رمز سرور تست شد ✓ (نشست ۱۲ ساعته)"
else
  say "تست login کد $CODE داد — اگر ۴۲۹ است، فقط محدودیت تلاش است و نصب موفق بوده"
fi

# ۴) وضعیت نهایی
H2="$(curl -sS -m 30 -A "$UA" "$API?action=health")"
if [ "$(printf '%s' "$H2" | jget installed)" = "True" ]; then ok "health حالا installed=true می‌گوید"; else die "health هنوز installed=false است"; fi
if [ -n "$SUM" ]; then printf '%s\n' "" "برای رمز تازه: پانل ← تب «ادمین‌ها» → رمز را عوض کنید → ذخیره → تب «همگام‌سازی سرور» → «🔑 رمز ادمین‌ها روی سرور»." >>"$SUM"; fi
echo "پایان: بک‌اند روی $SITE فعال است."
