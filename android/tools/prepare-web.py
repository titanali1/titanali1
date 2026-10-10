#!/usr/bin/env python3
"""همگام‌سازی پوستهٔ اندروید با سایت: index.html ریشهٔ مخزن → assets/web/

   python3 android/tools/prepare-web.py          # کپی + گزارش
   python3 android/tools/prepare-web.py --check  # فقط بررسی هم‌زمان بودن (برای CI)
"""
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]      # مخزن
SRC  = ROOT / 'index.html'
DST  = ROOT / 'android' / 'app' / 'src' / 'main' / 'assets' / 'web' / 'index.html'
GRAD = ROOT / 'android' / 'gradle.properties'

def ver_from_index():
    m = re.search(r"window\.titanali=\{ver:'([\d.]+)'", SRC.read_text(encoding='utf-8'))
    return m.group(1) if m else ''

def code_from_ver(v):
    p = [int(x) for x in (v.split('.') + ['0', '0', '0'])[:3]]
    return p[0] * 10000 + p[1] * 100 + p[2]

def props():
    d = {}
    for line in GRAD.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        d[k.strip()] = v.strip()
    return d

def main():
    check = '--check' in sys.argv
    if not SRC.is_file():
        sys.exit('✗ index.html در ریشهٔ مخزن نیست: %s' % SRC)
    src = SRC.read_bytes()
    dst_old = DST.read_bytes() if DST.is_file() else b''
    same = hashlib.sha256(src).hexdigest() == hashlib.sha256(dst_old).hexdigest()
    if check:
        print('✓ پوسته با index.html هم‌زمان است' if same else '✗ assets/web/index.html کهنه است — prepare-web.py را اجرا کنید')
        sys.exit(0 if same else 1)
    if same:
        print('· پوسته از قبل به‌روز است (%d بایت)' % len(src))
    else:
        DST.parent.mkdir(parents=True, exist_ok=True)
        DST.write_bytes(src)
        print('✓ پوسته همگام شد → %s (%d بایت)' % (DST.relative_to(ROOT), len(src)))

    # نسخه‌ها: versionName = نسخهٔ سایت، versionCode از فرمول major*10000+minor*100+patch
    v = ver_from_index()
    if not v:
        print('! نسخهٔ سایت در index.html پیدا نشد؛ gradle.properties را دستی بررسی کنید')
        return
    code = str(code_from_ver(v))
    p = props()
    changed = False
    text = GRAD.read_text(encoding='utf-8')
    for key, want in (('titanali.versionName', v), ('titanali.versionCode', code)):
        have = p.get(key, '')
        if have == want:
            print('✓ %s = %s' % (key, want))
            continue
        new, n = re.subn(r'(?m)^%s=.*$' % re.escape(key), '%s=%s' % (key, want), text)
        if n:
            text = new; changed = True
            print('· %s: %s → %s' % (key, have or '(none)', want))
        else:
            print('! کلید %s در gradle.properties نیست؛ دستی اضافه‌اش کنید (مقدار درست: %s)' % (key, want))
    if changed:
        GRAD.write_text(text, encoding='utf-8')
        print('✓ gradle.properties به‌روز شد')

if __name__ == '__main__':
    main()
