#!/usr/bin/env bash
# بسته را می‌سازد، تست‌ها را اجرا می‌کند، کامیت/پوش می‌کند و تگِ متحرّک `latest` را
# جلو می‌آورد — همان کاری که «لینک مستقیم» را همیشه تازه نگه می‌دارد.
#   bash deploy/publish-latest.sh            # تست‌ها + ساخت + پوش + تازکردن latest
#   SKIP_TESTS=1 bash deploy/publish-latest.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
BR="${BR:-$(git rev-parse --abbrev-ref HEAD)}"
SLUG="$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')"
[ -n "$SLUG" ] || { echo "✗ remote origin پیدا نشد"; exit 1; }

if [ -z "${SKIP_TESTS:-}" ]; then
  echo "── تست‌ها ──"
  node tests/run.js 2>&1 | tail -1
  node tests/sync.js 2>&1 | tail -1
  python3 tests/php-syntax.py api.php titanali-config.sample.php || exit 1
  python3 - <<'PYCHK'
import re, pathlib, sys
src = pathlib.Path("index.html").read_text(encoding="utf-8")
pathlib.Path("/tmp/ta-check.js").write_text(re.search(r"<script>([\s\S]*?)</script>", src).group(1), encoding="utf-8")
PYCHK
  node --check /tmp/ta-check.js && echo "✓ سینتکس JS" || { echo "✗ JS"; exit 1; }
fi

echo "── ساخت بسته ──"
python3 deploy/make-cpanel.py 2>&1 | grep -E "PNG|sha256|✔" || exit 1
sha256sum -c titanali-cpanel.zip.sha256 || { echo "✗ sha با بسته نمی‌خواند"; exit 1; }

git add -A
if git diff --cached --quiet; then echo "· فایل‌ها بدون تغییر"; else
  git commit -q -m "build: بستهٔ تازهٔ cpanel ($(date -u '+%Y-%m-%d %H:%M') UTC)" || exit 1
  echo "✓ کامیت شد"
fi
git push -q origin "HEAD:$BR" && echo "✓ پوش روی $BR" || { echo "✗ پوش نشد (اول git pull --rebase بزنید)"; exit 1; }
git tag -f latest >/dev/null && git push -f -q origin latest && echo "✓ تگ latest جلو آمد"

SHA="$(cut -d' ' -f1 titanali-cpanel.zip.sha256)"
echo
echo "لینک مستقیم (همیشه بستهٔ آخر):"
echo "  https://raw.githubusercontent.com/$SLUG/latest/titanali-cpanel.zip"
echo "  https://raw.githubusercontent.com/$SLUG/latest/titanali-cpanel.zip.sha256"
echo "تگ قفل‌شدهٔ همین نسخه: https://github.com/$SLUG/releases/tag/$(git describe --tags --abbrev=0 2>/dev/null || echo latest)"
echo "sha256: $SHA"
