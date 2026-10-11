#!/usr/bin/env bash
# ساخت محتوای .well-known/assetlinks.json (برای باز شدن لینک‌های سایت در اپ = verified App Links)
#   bash android/tools/assetlinks.sh                       # از keystore خودی
#   bash android/tools/assetlinks.sh <SHA256-fingerprint>  # اثر انگشت از Play Console
set -euo pipefail
cd "$(dirname "$0")/.."

PKG="$(grep -E '^titanali\.appId=' gradle.properties | cut -d= -f2 | tr -d ' ')"
FP="${1:-}"
if [[ -z "$FP" ]]; then
  [[ -f titanali-release.jks ]] || { echo "✗ titanali-release.jks نیست؛ یا بسازید یا اثر انگشت را پارامتر بدهید"; exit 1; }
  SP="$(grep -m1 '^storePassword=' keystore.properties | cut -d= -f2-)"
  FP=$(keytool -list -v -keystore titanali-release.jks -alias "${KEY_ALIAS:-titanali}" -storepass "$SP" \
      | awk '/SHA256:/{sub(/SHA256:/,"");gsub(/:/,"");gsub(/[ \t]/,"");print;exit}')
fi
[[ -n "$FP" ]] || { echo "✗ اثر انگشت به دست نیامد"; exit 1; }

cat <<JSON
[{"relation":["delegate_permission/common.handle_all_urls"],"context":{"namespace":"android_app","package_name":"$PKG","certificate_sha256":["$FP"]}}]
JSON
echo
echo "راهنما: خروجی بالا را در  public_html/.well-known/assetlinks.json  روی هاست بگذارید،"
echo "         سپس در AndroidManifest.xml مقدار autoVerify را «true» کنید و دوباره build بگیرید."
