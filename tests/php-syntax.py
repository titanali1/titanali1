#!/usr/bin/env python3
"""چک سینتکس فایل‌های PHP بدون نیاز به مفسر:  python3 tests/php-syntax.py [api.php]
   نیاز:  pip install --break-system-packages phply   (اگر نباشد، با کد خروج ۰ رد می‌شود)"""
import sys, pathlib
try:
    import phply
except ImportError:
    print("· phply نصب نیست — چک سینتکس رد شد (اختیاری است)")
    sys.exit(0)
f = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "api.php")
try:
    phply.parse(f.read_text(encoding="utf-8"))
    print("✓ سینتکس %s سالم است" % f.name)
except Exception as e:
    print("✗ %s: %s" % (f.name, e)); sys.exit(1)
