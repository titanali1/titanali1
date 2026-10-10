#!/usr/bin/env bash
# بستهٔ خودگردانِ پروژهٔ اندروید: titanali-android.zip
#   پوشهٔ android/ + فایل‌هایی که ابزارهایش لازم دارند (index.html، آیکون‌ها، privacy.html)
#   → خروجی تکرارپذیر (زمان ثابت، ترتیب نام‌ها) + .sha256 — کنار بستهٔ سی‌پنل منتشر می‌شود.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="titanali-android.zip"
python3 - "$OUT" <<'PY'
import os, sys, zipfile, hashlib, pathlib
out = sys.argv[1]
ROOT = pathlib.Path('.')
KEEP = ['android', 'index.html', 'privacy.html', 'icon-192.png', 'icon-512.png', 'maskable-512.png',
        'apple-touch-icon.png', 'favicon.svg', 'README.md']
SKIP_DIRS = {'build', '.gradle', '.idea', 'captures', 'node_modules', '__pycache__'}
SKIP_EXT = {'.jks', '.keystore', '.aab', '.apk', '.iml'}

files = []
for name in KEEP:
    p = ROOT / name
    if not p.exists():
        print('· نیست (رد شد):', name); continue
    if p.is_file():
        files.append(p); continue
    for d, sub, fs in os.walk(p):
        sub[:] = [s for s in sub if s not in SKIP_DIRS]
        for f in sorted(fs):
            if pathlib.Path(f).suffix in SKIP_EXT or f == 'keystore.properties' or f == 'local.properties':
                continue
            files.append(pathlib.Path(d) / f)
files = sorted(set(files), key=lambda x: str(x).replace('\\', '/'))

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files:
        i = zipfile.ZipInfo(str(f).replace('\\', '/'), date_time=(1980, 1, 1, 0, 0, 0))
        i.compress_type = zipfile.ZIP_DEFLATED
        i.external_attr = (0o644 << 16) | (0x10 if str(f).endswith('/') else 0)
        try: i.create_system = 3
        except Exception: pass
        z.writestr(i, f.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

h = hashlib.sha256(pathlib.Path(out).read_bytes()).hexdigest()
pathlib.Path(out + '.sha256').write_text('%s  %s\n' % (h, out), encoding='utf-8')
print('✓ %s — %d فایل، %d بایت' % (out, len(files), pathlib.Path(out).stat().st_size))
print('sha256:', h)
PY
echo "لینک: https://raw.githubusercontent.com/<user>/<repo>/latest/$OUT"
