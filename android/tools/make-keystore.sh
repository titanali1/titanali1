#!/usr/bin/env bash
# ساخت کلید امضا (یک‌بار) + فایل keystore.properties
#   bash android/tools/make-keystore.sh
# ⚠️ این کلید را گم نکنید: بدون آن، به‌روزرسانی برنامه در گوگل‌پلی و مایکت ممکن نیست.
set -euo pipefail
cd "$(dirname "$0")/.."

ALIAS="${KEY_ALIAS:-titanali}"
DNAME="${KEY_DNAME:-CN=titanali, OU=studio, O=titanali, L=Tehran, ST=Tehran, C=IR}"
VALIDITY="${KEY_DAYS:-10950}"     # ۳۰ سال
OUT="titanali-release.jks"

if [[ -f "$OUT" ]]; then
  echo "! $OUT از قبل هست؛ چیزی نساختیم."
else
  read -r -s -p "رمز کلید (حداقل ۸ نویسه، دو بار): " P1; echo
  read -r -s -p "  ↵ بار دوم: " P2; echo
  [[ "$P1" == "$P2" ]] || { echo "✗ رمزها یکی نبود"; exit 1; }
  [[ ${#P1} -ge 8 ]] || { echo "✗ رمز کوتاه است"; exit 1; }
  keytool -genkeypair -v \
    -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 2048 \
    -validity "$VALIDITY" -storepass "$P1" -keypass "$P1" -dname "$DNAME"
  printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' "$OUT" "$P1" "$ALIAS" "$P1" > keystore.properties
  chmod 600 keystore.properties "$OUT"
  cat <<'NOTE'

✓ ساخته شد: titanali-release.jks + keystore.properties (هر دو در .gitignore هستند)
• اگر در گوگل‌پلی «Play App Signing» روشن است، کلید بالا «upload key» است؛ کلید امضای
  نهایی را گوگل نگه می‌دارد — برای assetlinks.json باید اثر انگشت «App signing key» را
  از Play Console بردارید (راهنما: BUILD.md).
• در مایکت و کافه‌بازار همین کلید، کلید نهایی است؛ از دست دادنش = از دست دادن اپ.
NOTE
fi
