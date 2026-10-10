#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بازین ساختاری فایل‌های PHP (بی‌نیاز از مفسر و بی‌نیاز از هر پکیج).

چک می‌کند:
  • فایل با <?php شروع می‌شود و برچسب بستن ?> ندارد   (فایلِ خالصِ PHP)
  • {} () [] متوازن‌اند (خارج از رشته و کامنت)
  • هیچ ساختار جدیدتر از PHP 7.0 استفاده نشده: ??  ?->  <=>  match(  fn(  str_*_with(  readonly  enum  #[]
  • تعداد تابع‌های تعریف‌شده، و نام‌های ta_* که سایت به آن‌ها تکیه می‌کند

اجرا:  python3 tests/php-syntax.py [api.php ...]      خروج ۰ = سالم
"""
import re
import sys
import pathlib

NEWER = [
    (r'\?\?', '??  (PHP 7.0 دارد، ولی 7.1 نه؛ در این پروژه استفاده نشود)'),
    (r'\?->',  '?->  (PHP 8)'),
    (r'<=>',   '<=>  (spaceship)'),
    (r'\bmatch\s*\(', 'match(  (PHP 8)'),
    (r'\bfn\s*\(', 'fn(  (arrow fn، PHP 7.4)'),
    (r'\bstr_contains\s*\(|\bstr_starts_with\s*\(|\bstr_ends_with\s*\(', 'str_*_with(  (PHP 8)'),
    (r'\breadonly\b', 'readonly  (PHP 8.1)'),
    (r'^\s*enum\s+\w', 'enum  (PHP 8.1)'),
    (r'^\s*#\w+\s*$', 'attribute  #[]  (PHP 8)'),
    (r'\barray_is_list\s*\(|\bstr_increment\s*\(', 'تابع PHP 8.3'),
]
WANT = ['ta_out', 'ta_read', 'ta_put', 'ta_lock', 'ta_cfg', 'ta_need_admin', 'ta_check_pw']


def php_only(src):
    """فقط بخش‌های PHP (بین <?php و ?>) — تا HTML/CSSِ فایل‌های نمایشی شمرده نشود."""
    out, i, n = [], 0, len(src)
    while i < n:
        a, b = src.find('<?php', i), src.find('<?=', i)
        if a < 0 and b < 0:
            break
        start = a if (a >= 0 and (b < 0 or a < b)) else b
        end = src.find('?>', start)
        stop = n if end < 0 else end
        seg = src[start:stop]
        seg = seg[5:] if seg.startswith('<?php') else seg[2:]
        out.append(seg + '\n')
        i = n if end < 0 else end + 2
    return ''.join(out) if out else src


def strip_php(src):
    """حذف رشته‌ها و کامنت‌ها (برای شمارش متوازن بودن)."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        two = src[i:i + 2]
        if two == '/*':
            end = src.find('*/', i)
            if end < 0:
                break
            i = end + 2
            continue
        if two == '//' or c == '#':
            end = src.find('\n', i)
            if end < 0:
                break
            i = end
            continue
        if c in ('"', "'"):
            q, i = c, i + 1
            while i < n:
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == q:
                    i += 1
                    break
                i += 1
            out.append('""')
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def check(path):
    f = pathlib.Path(path)
    if not f.exists():
        return ['فایل پیدا نشد: %s' % f]
    src = f.read_text(encoding='utf-8')
    errs = []
    if not src.lstrip().startswith('<?php'):
        errs.append('سطر اول باید <?php باشد')
    if '?>' in src and 'api' in f.name:
        errs.append('فایل API برچسب بستن ?> دارد (خروجی JSON را خراب می‌کند)')
    if src.startswith('\ufeff') or src.lstrip().startswith('\ufeff'):
        errs.append('BOM دارد؛ خروجی JSON را خراب می‌کند')
    clean = strip_php(php_only(src))
    for a, b in (('{', '}'), ('(', ')'), ('[', ']')):
        if clean.count(a) != clean.count(b):
            errs.append('عدم توازن %s%s: %d در برابر %d' % (a, b, clean.count(a), clean.count(b)))
    depth = 0
    for line_no, line in enumerate(clean.split('\n'), 1):
        for ch in line:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth < 0:
                    errs.append('آکولاد بستن اضافه در سطر %d' % line_no)
                    depth = 0
    if depth:
        errs.append('%d آکولاد باز مانده' % depth)
    for pat, why in NEWER:
        for m in re.finditer(pat, clean, re.M):
            errs.append('سطر %d: %s' % (clean[:m.start()].count('\n') + 1, why))
    if 'api' in f.name:
        names = re.findall(r'function\s+(ta_\w+)', src)
        missing = [w for w in WANT if w not in names]
        if missing:
            errs.append('توابع مورد انتظار پیدا نشد: ' + ', '.join(missing))
    if 'api' in f.name:
        if re.search(r"ini_set\(\s*['\"]display_errors['\"]\s*,\s*['\"]0", src) is None:
            errs.append('برای فایل API، `ini_set("display_errors","0")` لازم است تا خطا در JSON نشت نکند')
        if "no-store" not in src:
            errs.append('هدر Cache-Control: no-store روی پاسخ‌ها تنظیم نشده')
    return errs


bad = 0
files = sys.argv[1:] or ['api.php']
for path in files:
    errs = check(path)
    if errs:
        bad += 1
        print('✗ %s' % path)
        for e in errs:
            print('   · ' + e)
    else:
        src = pathlib.Path(path).read_text(encoding='utf-8')
        print('✓ %s — سالم و سازگار با PHP 7.0 (%d خط، %d تابع)'
              % (path, src.count('\n') + 1, len(re.findall(r'function\s+\w+', src))))
sys.exit(1 if bad else 0)
