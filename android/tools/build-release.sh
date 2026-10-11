#!/usr/bin/env bash
# ساخت نسخهٔ آمادهٔ انتشار: AAB برای گوگل‌پلی + APK امضاشده برای مایکت/کافه‌بازار
#   bash android/tools/build-release.sh            # هر دو
#   bash android/tools/build-release.sh apk        # فقط APK
set -euo pipefail
cd "$(dirname "$0")/.."

GRADLE() {
  if [[ -x ./gradlew ]]; then ./gradlew "$@"
  elif command -v gradle >/dev/null 2>&1; then gradle "$@"
  else echo "✗ نه gradlew دارید و نه gradle — یک‌بار اجرا کنید:  gradle wrapper --gradle-version 8.13" ; exit 1; fi
}

echo "── ۱) همگام‌سازی پوسته با index.html سایت"
python3 tools/prepare-web.py
python3 tools/prepare-icons.py

echo "── ۲) build"
if [[ "${1:-both}" == "apk" ]]; then
  GRADLE clean assembleRelease --warning-mode all
else
  GRADLE clean bundleRelease assembleRelease --warning-mode all
fi

echo "── ۳) خروجی‌ها"
AAB=app/build/outputs/bundle/release/app-release.aab
APK=app/build/outputs/apk/release/app-release.apk
for f in "$AAB" "$APK"; do
  [[ -f "$f" ]] || continue
  printf '   %s  ·  %s بایت\n' "$f" "$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")"
  shasum -a 256 "$f" 2>/dev/null | awk '{printf "   sha256 %s\n", $1}' || sha256sum "$f"
done

if [[ ! -f "$APK" && ! -f "$AAB" ]]; then echo "✗ خروجی پیدا نشد — لاگ بالا را ببینید"; exit 1; fi

echo "── ۴) بررسی امضا"
if command -v apksigner >/dev/null 2>&1 && [[ -f "$APK" ]]; then
  apksigner verify --print-certs "$APK" | sed 's/^/   /' | head -12
elif command -v keytool >/dev/null 2>&1 && [[ -f "$APK" ]]; then
  keytool -printcert -jarfile "$APK" | sed 's/^/   /' | head -12
fi
[[ -f keystore.properties ]] || echo "! keystore.properties نبود → خروجی امضاشده نیست (برای مارکت‌ها نشود)"
echo "✓ آماده. آپلود: AAB → Play Console، APK → مایکت/کافه‌بازار (راهنما: STORE-GOOGLE.md و STORE-MYKET.md)"
