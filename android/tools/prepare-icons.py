#!/usr/bin/env python3
"""ساخت آیکون‌های اندروید از آیکون‌های آمادهٔ سایت (بدون نیاز به Pillow).

   · icon-192.png / icon-512.png        → mipmap-*/ic_launcher.png
   · maskable-512.png                   → mipmap-*/ic_launcher_round.png + لایهٔ foreground آیکون تطبیقی
   · پوشهٔ store/ هم پر می‌شود: آیکون ۵۱۲ برای مایکت/کافه‌بازار و منبع بنر گوگل‌پلی
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RES  = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
STORE = ROOT / 'android' / 'store'

DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
SRC_ANY   = ROOT / 'icon-192.png'
SRC_BIG   = ROOT / 'icon-512.png'
SRC_MASK  = ROOT / 'maskable-512.png'

def need(p):
    if not p.is_file():
        sys.exit('✗ فایل لازم نیست: %s' % p)
    return p

def main():
    need(SRC_ANY); need(SRC_BIG); need(SRC_MASK)
    STORE.mkdir(parents=True, exist_ok=True)
    for d in DENSITIES:
        out = RES / ('mipmap-' + d)
        out.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC_ANY, out / 'ic_launcher.png')
        shutil.copyfile(SRC_MASK, out / 'ic_launcher_round.png')
    fg = RES / 'drawable-nodpi'
    fg.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC_MASK, fg / 'ic_launcher_fg.png')
    shutil.copyfile(SRC_BIG, STORE / 'icon-512.png')
    shutil.copyfile(SRC_MASK, STORE / 'icon-512-maskable.png')
    shutil.copyfile(SRC_BIG, STORE / 'feature-graphic-src.png')
    n = len(DENSITIES) * 2 + 3
    print('✓ %d فایل آیکون ساخته شد (mipmap×%d + foreground + store/)' % (n, len(DENSITIES)))
    print('  اگر لوگوی تازه‌ای دارید: icon-512.png / maskable-512.png را در ریشه عوض کنید و این اسکریپت را دوباره اجرا کنید.')

if __name__ == '__main__':
    main()
