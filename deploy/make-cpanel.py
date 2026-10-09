#!/usr/bin/env python3
"""
make-cpanel.py — بستهٔ آمادهٔ هاست سی‌پنل می‌سازد.

  python3 deploy/make-cpanel.py

خروجی:
  dist/titanali-cpanel/     ← محتوای public_html (کپی کنید یا زیپ را آپلود/استخراج کنید)
  dist/titanali-cpanel.zip
آیکون‌ها و og.png را با Pillow + فونت Vazirmatn می‌سازد (اگر نصب نباشند، نسخهٔ بدون PNG ساخته می‌شود).
"""
import json, os, re, shutil, zipfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC  = ROOT / 'index.html'
DIST = ROOT / 'dist' / 'titanali-cpanel'
# فایل‌های عمومی که باید در ریشه (و پس از آن در public_html) باشند
PUBLIC = ['index.html', '.htaccess', '404.html', 'sw.js', 'api.php', 'titanali-config.sample.php', 'site.webmanifest', 'favicon.svg',
          'robots.txt', 'sitemap.xml', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
          'maskable-512.png', 'og.png']
COPIES = ['.htaccess', 'sw.js', '404.html', 'robots.txt', 'sitemap.xml', 'titanali-config.sample.php']  # منبعشان deploy/files/ است
SITE = 'https://titanali.ir/'
BRAND, TAG_FA, TAG_EN = 'titanali', 'طراحی و دوخت', 'Design & Tailoring · Tehran'

os.makedirs(DIST, exist_ok=True)

# ---------------------------------------------------------------- PNGها
def make_pngs():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        print('· Pillow نصب نیست — PNGها ساخته نشد (فقط SVG و متن راهنما).'); return []
    def shape(txt):
        try:
            import arabic_reshaper
            from bidi.algorithm import get_display
            return get_display(arabic_reshaper.reshape(txt))
        except Exception:
            return txt
    F = '/tmp/fonts/vazirmatn-33.003/fonts/ttf/Vazirmatn-Bold.ttf'
    FB = '/tmp/fonts/vazirmatn-33.003/fonts/ttf/Vazirmatn-Black.ttf'
    if not os.path.exists(F):
        import urllib.request, tarfile, io
        try:
            os.makedirs('/tmp/fonts', exist_ok=True)
            u = 'https://codeload.github.com/rastikerdar/vazirmatn/tar.gz/refs/tags/v33.003'
            with urllib.request.urlopen(u, timeout=90) as r, tarfile.open(fileobj=io.BytesIO(r.read())) as t:
                for m in t.getmembers():
                    if m.name.endswith('fonts/ttf/Vazirmatn-Bold.ttf') or m.name.endswith('fonts/ttf/Vazirmatn-Black.ttf'):
                        t.extract(m, '/tmp/fonts')
            F = [p for p in [
                '/tmp/fonts/vazirmatn-33.003/fonts/ttf/Vazirmatn-Bold.ttf',
                '/tmp/fonts/vazirmatn-33.003/fonts/ttf/Vazirmatn-ExtraBold.ttf'] if os.path.exists(p)][0]
            FB = F
        except Exception as e:
            print('· فونت Vazirmatn در دسترس نبود (%s) — از DejaVu استفاده می‌شود.' % e)
            F = FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    def font(sz, bold=False):
        try: return ImageFont.truetype(FB if bold else F, sz)
        except Exception: return ImageFont.load_default()
    A, B = (77, 166, 255), (10, 132, 255)
    def grad(sz):
        im = Image.new('RGB', (sz, sz), A)
        d = ImageDraw.Draw(im)
        for y in range(sz):
            t = y / max(1, sz - 1)
            d.line([(0, y), (sz, y)], fill=(int(A[0]+(B[0]-A[0])*t), int(A[1]+(B[1]-A[1])*t), int(A[2]+(B[2]-A[2])*t)))
        return im
    def kilim(d, x0, y0, x1, y1, tile):
        """نوار بافت کیلی: لوزی‌های قرمز/کرم"""
        cols = ['#f2e6cf', '#a01f1f', '#241f2e']
        y = y0
        while y < y1:
            x = x0
            while x < x1:
                d.polygon([(x+tile/2, y), (x+tile, y+tile/2), (x+tile/2, y+tile), (x, y+tile/2)], fill=cols[1])
                d.polygon([(x+tile/2, y+tile*.26), (x+tile*.74, y+tile/2), (x+tile/2, y+tile*.74), (x+tile*.26, y+tile/2)], fill=cols[0])
                d.rectangle([x+tile*.44, y+tile*.44, x+tile*.56, y+tile*.56], fill=cols[2])
                x += tile
            y += tile
    def mark(sz, pad=0, bleed=False):
        """مربع گرادیانی + نشان «ta». bleed=True برای آیکون maskable (پس‌زمینهٔ تمام‌صفحه)."""
        im = Image.new('RGBA', (sz, sz), (5, 4, 9, 0))
        d = ImageDraw.Draw(im)
        base = grad(sz)
        if bleed:
            im.paste(base, (0, 0))
        else:
            mask = Image.new('L', (sz, sz), 0)
            ImageDraw.Draw(mask).rounded_rectangle([pad, pad, sz-pad, sz-pad], radius=int(sz*0.235), fill=255)
            im.paste(base, (0, 0), mask)
        f = font(int(sz*0.34), True)
        t = 'ta'
        w = d.textbbox((0, 0), t, font=f)
        d.text((sz/2-(w[2]-w[0])/2-w[0], sz/2-(w[3]-w[1])/2-w[1]), t, font=f, fill=(255, 255, 255, 255))
        return im
    out = []
    for name, size in [('icon-192.png', 192), ('icon-512.png', 512),
                       ('apple-touch-icon.png', 180), ('maskable-512.png', 512)]:
        p = DIST / name
        bleed = name.startswith('maskable')
        im = mark(size, bleed=bleed)
        if 'apple' in name or bleed:
            bg = Image.new('RGB', (size, size), (5, 4, 9)); bg.paste(im, (0, 0), im); im = bg.convert('RGBA')
        im.save(p, 'PNG'); out.append(name)
    # ---- og.png (1200×630)
    W, H = 1200, 630
    og = Image.new('RGB', (W, H), (7, 6, 14))
    d = ImageDraw.Draw(og)
    for i in range(H):
        t = i / H
        d.line([(0, i), (W, i)], fill=(int(7+16*t), int(6+10*t), int(14+30*t)))
    for cx, cy, r, col in [(1050, 90, 260, (77, 166, 255, 46)), (170, 560, 300, (168, 85, 247, 40)), (760, 470, 200, (255, 55, 95, 26))]:
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(lay).ellipse([cx-r, cy-r, cx+r, cy+r], fill=col)
        og = Image.alpha_composite(og.convert('RGBA'), lay).convert('RGB'); d = ImageDraw.Draw(og)
    tile = 46
    kilim(d, 0, 0, W, tile, tile)
    kilim(d, 0, H-tile, W, H, tile)
    d.rectangle([0, tile, W, tile+3], fill=(242, 230, 207))
    d.rectangle([0, H-tile-3, W, H-tile], fill=(242, 230, 207))
    im = mark(196); og.paste(im, (78, 132), im)
    d.text((308, 150), BRAND, font=font(96, True), fill=(255, 255, 255))
    d.text((310, 262), shape(TAG_FA), font=font(56), fill=(200, 214, 236))
    d.text((310, 348), TAG_EN, font=font(30), fill=(120, 140, 172))
    d.line([(310, 404), (860, 404)], fill=(77, 166, 255, 120), width=2)
    d.text((310, 428), shape('پلیواری · تمام کش · دانوکی · بنوک ها'), font=font(34), fill=(228, 232, 244))
    d.text((310, 500), SITE.replace('https://', '').rstrip('/'), font=font(28), fill=(120, 140, 172))
    og.save(DIST / 'og.png', 'PNG', optimize=True); out.append('og.png')
    print('· PNGها ساخته شد:', ', '.join(out))
    return out

# ---------------------------------------------------------------- متن‌ها
SVG_ICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4da6ff"/><stop offset="1" stop-color="#0a84ff"/></linearGradient></defs>
<rect width="64" height="64" rx="15" fill="url(#g)"/>
<text x="32" y="44" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">ta</text>
</svg>"""

MANIFEST = {
  "name": f"{BRAND} — {TAG_FA}", "short_name": BRAND,
  "description": "طراحی و دوخت تیتانلی — طرح‌های جدید، پلیواری، تمام کش، دانوکی و بنوک ها",
  "id": SITE, "lang": "fa", "dir": "rtl",
  "start_url": "./", "scope": "./", "display": "standalone", "orientation": "portrait",
  "background_color": "#050409", "theme_color": "#050409", "categories": ["shopping", "lifestyle"],
  "icons": [
    {"src": "./icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "./maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ],
  "shortcuts": [
    {"name": "طرح‌ها", "url": "./#gallery", "icons": [{"src": "./icon-192.png", "sizes": "192x192"}]},
    {"name": "گفتگو برای سفارش", "url": "./#chat", "icons": [{"src": "./icon-192.png", "sizes": "192x192"}]}
  ]
}


def write(name, text):
    (DIST / name).write_text(text, encoding='utf-8')
    print('·', name)

def main():
    # ۱) فایل‌های عمومی به ریشه نوشته می‌شوند تا ریشه = public_html
    for f in COPIES:
        shutil.copyfile(ROOT / 'deploy' / 'files' / f, ROOT / f); print('root/', f)
    (ROOT / 'favicon.svg').write_text(SVG_ICON, encoding='utf-8'); print('root/ favicon.svg')
    (ROOT / 'site.webmanifest').write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding='utf-8')
    print('root/ site.webmanifest')
    global DIST
    DIST = ROOT / 'dist' / 'titanali-cpanel'
    if DIST.exists(): shutil.rmtree(DIST)
    os.makedirs(DIST, exist_ok=True)
    pngs = make_pngs()                      # PNGها را در DIST می‌سازد
    for f in pngs:
        shutil.copyfile(DIST / f, ROOT / f); print('root/', f)
    # ۲) بسته‌بندی از روی ریشه
    for f in PUBLIC:
        if (ROOT / f).exists(): shutil.copyfile(ROOT / f, DIST / f)
    z = ROOT / 'dist' / 'titanali-cpanel.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in sorted(DIST.iterdir()):
            if p.is_file(): zf.write(p, p.name)
    n = len([x for x in DIST.iterdir() if x.is_file()])
    print('\n✔ %s  (%.1f KB، %d فایل)' % (z, z.stat().st_size / 1024, n))
    print('  در سی‌پنل: File Manager → public_html → Upload این zip → Extract (با «Overwrite»).')
    print('  یا فقط محتویات dist/titanali-cpanel/ را در public_html کپی کنید.')
    api = ROOT / 'api.php'
    if api.exists():
        print('  بک‌اند PHP داخل بسته است (api.php) — برای همگام‌سازی محتوا و صندوق مشترک؛ اختیاری است.')
        print('  PHP 7.0+ لازم است. اگر هاست فقط استاتیک است، api.php را نکپی کنید؛ سایت بدون آن کار می‌کند.')
    print('  بازسازی بعد از هر تغییر: python3 deploy/make-cpanel.py')

if __name__ == '__main__':
    main()
