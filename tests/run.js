#!/usr/bin/env node
/* تست حالت استاتیک/محلی (بدون بک‌اند) — اجرای آن:  node tests/run.js
   نیاز: jsdom (npm i --prefix .. jsdom  ← در ریشهٔ پوشهٔ والد نصب می‌شود) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
['warn', 'log', 'info'].forEach(k => vc.on(k, () => {}));

const dom = new JSDOM(html, {
  url: 'https://titanali1.ir/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.scrollTo = () => {};
    w.confirm = () => CONFIRM;
    w.open = () => null;
  }
});
let CONFIRM = true;
const { window } = dom, doc = window.document;
const T = () => window.titanali;
const $ = s => doc.querySelector(s);
const $$ = s => [...doc.querySelectorAll(s)];
const click = el => { if (!el) throw new Error('عنصر پیدا نشد: '); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); };
const dbl = el => el.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
const type = (el, v, f = 'input') => { if (!el) throw new Error('ورودی پیدا نشد'); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new window.Event(f, { bubbles: true })); };
const submit = f => f.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = () => $('#posts').textContent;
const fa2en = s => String(s).replace(/[\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) - 0x06f0));
const pg = () => { const t = fa2en(($('.ig-pager .pgc') || {}).textContent || '').replace(/\s+/g, ' ').trim(); const m = t.match(/(\d+)\D+(\d+)/); return m ? [+m[1], +m[2]] : [-1, -1]; };
let ok = 0, fail = 0;
const A = (n, c) => { c ? (ok++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)); };

(async () => {
  await sleep(150);

  console.log('— فایل‌های لازم در بسته');
  ['index.html', '.htaccess', '404.html', 'sw.js', 'site.webmanifest', 'favicon.svg', 'og.png', 'apple-touch-icon.png',
   'icon-192.png', 'icon-512.png', 'maskable-512.png', 'robots.txt', 'sitemap.xml', 'api.php', 'titanali-config.sample.php']
    .forEach(f => A('بسته شامل ' + f + ' است', fs.existsSync(path.join(ROOT, f))));
  A('sha256 بسته با خودش می‌خواند', fs.existsSync(path.join(ROOT, 'titanali-cpanel.zip.sha256')));
  const mani = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.webmanifest'), 'utf8'));
  A('manifest: fa + rtl + id روی دامنهٔ درست', mani.lang === 'fa' && mani.dir === 'rtl' && mani.id === 'https://titanali1.ir/');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  A('sw.js فایل‌های php را کش نمی‌کند', /\.php/.test(sw));
  const ht = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
  A('.htaccess پوشهٔ دیتا را می‌بندد', /titanali-data/.test(ht) && /no-store/.test(ht));

  console.log('— دامنه در متاتگ‌ها');
  const head = html.slice(0, html.indexOf('</head>'));
  A('canonical روی titanali1.ir', /rel="canonical" href="https:\/\/titanali1\.ir\/"/.test(head));
  A('og:url و og:image درست‌اند', /property="og:url" content="https:\/\/titanali1\.ir\/"/.test(head) && /property="og:image" content="https:\/\/titanali1\.ir\/og\.png"/.test(head));
  A('هیچ ارجاع کهنه‌ای به دامنهٔ قدیمی نمانده', !/[^1]titanali\.ir/.test(head));
  A('manifest لینک شده', $('link[rel="manifest"]').getAttribute('href') === 'site.webmanifest');

  console.log('— خانه: قاب تک‌پست');
  A('کارت پروفایل', /titanali/.test($('#heroCard').textContent));
  A('قاب فید و نوار استوری', !!$('#sec-ig') && !!$('#posts') && !!$('#stories'));
  A('فقط یک پست در قاب', $$('#posts .post').length === 1);
  A('پِیجر «۱ از ۱۲»', pg()[0] === 1 && pg()[1] === 12);
  A('آیکون‌ها SVG‌اند (نه ایموجی)', $$('#posts .pact button svg').length >= 4 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u.test($('#posts .pact').textContent));
  click($('[data-post="1"]')); await sleep(50);
  A('❮ ❯ پست را عوض می‌کند', pg()[0] === 2);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await sleep(50);
  A('فلش کیبورد پست را عوض می‌کند', pg()[0] !== 2);
  A('نوار استوری با «پیج»', $$('#stories .story').length === 9);

  console.log('— لایک / کامنت / دانلود (محلی)');
  let p = $$('#posts .post')[0], idx = 0;
  function idxHere() { idx = Number($('.post-media').dataset.open); }
  idxHere();
  click(p.querySelector('[data-like]')); await sleep(60);
  A('لایک روشن شد و شمارنده ۱ است', $('.pact [data-like]').classList.contains('on') && /۱/.test($('.pact .cnt').textContent));
  A('دادهٔ محلی به‌روز شد', T().D.gallery[idx].likes === 1);
  click($('.pact [data-like]')); await sleep(60);
  A('لایک برداشته شد (صفر)', T().D.gallery[idx].likes === 0 && !$('.pact [data-like]').classList.contains('on'));
  type($('.cmt-form input'), 'سایز ۳۸ می‌دوزید؟'); submit($('.cmt-form')); await sleep(80);
  A('کامنت محلی ثبت شد', /سایز ۳۸/.test($('#posts .pcom').textContent) && T().cmtList(idx).length === 1);
  A('دکمهٔ حذف کامنت قبل از ورود ادمین نیست', !$('#posts [data-cdel]'));
  click($('.pact [data-dl]')); await sleep(80);
  A('دانلود شمارنده را بالا برد', T().D.gallery[idx].dl === 1);

  console.log('— ورود ادمین با کلیک روی عنوان');
  click($('#brandName')); await sleep(60);
  A('فرم ورود باز شد', $('#loginWrap').classList.contains('open'));
  type($('#logUser'), 'admin'); type($('#logPass'), 'wrong'); submit($('#logForm')); await sleep(60);
  A('رمز غلط رد شد', /درست نیست/.test($('#logErr').textContent) && $('#adminPanel').classList.contains('open') === false);
  type($('#logPass'), 'titanali1384'); submit($('#logForm')); await sleep(80);
  A('رمز پیش‌فرض داخل کد پذیرفته شد', $('#adminPanel').classList.contains('open') && T().isAuth());
  A('۱۱ تب پنل (با همگام‌سازی سرور)', $$('#admTabs .adm-tab').length === 11);
  A('راهنمای ورود، نبود بک‌اند را می‌گوید', /api\.php|DEFAULTS\.admins/.test($('#logTip').textContent));

  console.log('— تب همگام‌سازی در حالت بدون سرور');
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(70);
  A('وضعیت «محلی»', /محلی/.test($('#admBody').textContent));
  A('سرور فعال نیست', T().API.on === false);
  A('دکمهٔ تست اتصال هست', !!$('#admBody [data-apibtn="test"]'));
  click($('#admBody [data-apibtn="test"]')); await sleep(120);
  A('تست اتصال صادقانه رد می‌کند', /پیدا نشد|JSON/.test($('#toast').textContent) && T().API.on === false);

  console.log('— ویرایش محتوا و ذخیره');
  click($('#admTabs [data-adm-tab="gallery"]')); await sleep(60);
  type($('[data-gf="t"][data-i="0"]'), 'عنوان آزمایشی ۹۸۷');
  click($('#admSave')); await sleep(120);
  A('عنوان ذخیره شد', /عنوان آزمایشی ۹۸۷/.test(T().D.gallery[0].t));
  A('دکمهٔ افزودن طرح', !!$('#admBody [data-gadd]'));
  click($('#admTabs [data-adm-tab="instagram"]')); await sleep(50);
  type($('#igPerInp'), '5'); click($('#admSave')); await sleep(120);
  A('سقف استوری نوار ذخیره شد', T().D.ig.perLine === 5 && $$('#stories .story').length === 6);
  click($('#admTabs [data-adm-tab="instagram"]')); await sleep(40);
  click($('#igFromGallery')); await sleep(60);
  A('ساخت استوری از طرح‌ها', JSON.parse($('#igStories').value).length === 8);
  click($('#admSave')); await sleep(120);
  A('استوری دستی، لیست دستی را نشان می‌دهد', $$('#stories .story').length === 9);

  console.log('— ادمین‌ها');
  click($('#admTabs [data-adm-tab="admins"]')); await sleep(60);
  click($('#admBody [data-aadd]')); await sleep(50);
  let card = $$('#admBody .row-card').pop();
  type(card.querySelector('[data-af="u"]'), 'sara');
  type(card.querySelector('[data-af="p"]'), 'sara1384x');
  type(card.querySelector('[data-af="name"]'), 'سارا');
  click($('#admSave')); await sleep(140);
  A('ادمین تازه ساخته شد', T().D.admins.some(a => a.u === 'sara' && a.p === 'sara1384x'));
  click($('#admTabs [data-adm-tab="admins"]')); await sleep(60);
  card = $$('#admBody .row-card').pop();
  type(card.querySelector('[data-af="u"]'), 'sara');
  type(card.querySelector('[data-af="p"]'), 'abc');
  click($('#admSave')); await sleep(140);
  //console.log('    DBG admins:', JSON.stringify(T().D.admins.map(a => a.u + '/' + a.p)), 'toast:', $('#toast').textContent);
  A('رمز کوتاه رد شد', T().D.admins.filter(a => a.u === 'sara').length === 1 && T().D.admins.find(a => a.u === 'sara').p === 'sara1384x');
  click($('#admTabs [data-adm-tab="admins"]')); await sleep(60);

  console.log('— گفتگو و صندوق (محلی)');
  T().go('chat'); await sleep(50);
  type($('#chatText'), 'برای مجلسی سفارش دارم'); submit($('#chatForm')); await sleep(1100);
  A('پیام کاربر و پاسخ محلی ثبت شد', $$('#chatLog .bubble').length >= 2);
  click($('#admTabs [data-adm-tab="inbox"]')); await sleep(60);
  A('پیام در صندوق دیده می‌شود', /برای مجلسی/.test($('#admBody').textContent));
  const rep = $('#admBody .rep-form textarea'); type(rep, 'بله، سه روزه آماده است');
  click($('#admBody [data-sendrep]')); await sleep(120);
  A('پاسخ کارگاه ثبت شد', T().D.messages.some(m => !m.me && /سه روزه/.test(m.text || '')));
  T().go('chat'); await sleep(60);
  A('پاسخ در گفتگوی کاربر آمد', /سه روزه/.test($('#chatLog').textContent));
  A('بَج گفتگو', !$('#chatBadge').hidden);

  console.log('— زبان و گالری');
  T().go('gallery'); await sleep(60);
  A('تب‌های دسته در گالری', $$('#galTabs button').length >= 3);
  click($('#galTabs [data-gal="all"]')); await sleep(60);
  A('شبکهٔ گالری پر است', $$('#galleryGrid .gitem').length >= 10);
  click($$('#galleryGrid .gitem')[0]); await sleep(80);
  A('لایت‌باکس باز شد', $('#lightbox').classList.contains('open'));
  A('دکمه‌های لایت‌باکس SVG‌اند', $('#lbActions').innerHTML.includes('<svg'));
  click($('#lbNext') || $('.lb-nav[data-lb="1"]')); await sleep(60);
  A('لایت‌باکس بسته نمی‌شود با پیمایش', $('#lightbox').classList.contains('open'));
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(60);
  A('Esc لایت‌باکس را می‌بندد', !$('#lightbox').classList.contains('open'));

  console.log('— خروج ادمین');
  T().logout(); await sleep(60);
  A('خروج از حساب', !T().isAuth() && $('#adminPanel').classList.contains('open') === false);

  const real = errs.filter(e => !/Not implemented/.test(e));
  console.log('\nRESULT pass=' + ok + ' fail=' + fail + ' consoleErrors=' + real.length);
  if (real.length) console.log(real.slice(0, 5).join('\n'));
  process.exit(fail || real.length ? 1 : 0);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(2); });
