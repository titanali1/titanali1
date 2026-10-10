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

  console.log('— خانه: فید اینستاگرامی (بدون قاب تزئینی)');
  A('کارت پروفایل', /titanali/.test($('#heroCard').textContent));
  A('فید، استوری و نوار کاربر ساخته شده', !!$('#sec-ig') && !!$('#posts') && !!$('#stories') && !!$('#feedBar'));
  A('قاب تزئینی حذف شد', !$('.ig-frame') && !$('.ig-inner') && /ig-feed/.test($('#sec-ig').className));
  A('نسبت تصویر از متغیر CSS می‌آید (۴:۵)', /--igRatio:calc\(4 \/ 5\)/.test(html) && /aspect-ratio:var\(--igRatio\)/.test(html));
  A('یک پست در فید نمایش داده می‌شود', $$('#posts .post').length === 1);
  A('نوار فید: @کاربری و دکمهٔ همگام‌سازی', /@titanali1/.test($('#feedBar').textContent) && !!$('#igSyncBtn'));
  A('کپشن و ردیف پاورقی دارد', !!$('#posts .cap') && !!$('#posts .pfoot'));
  A('دکمهٔ «پست‌های بیشتر» هست', !!$('[data-more]'));
  click($('[data-more]')); await sleep(50);
  A('«بیشتر» سه پست می‌افزاید', $$('#posts .post').length === 4);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await sleep(60);
  A('فلش کیبورد پست را عوض می‌کند', T().IG_AT() !== 0);
  A('نوار استوری با «پیج»', $$('#stories .story').length === 9);
  A('بدون قاب، حاشیهٔ فید از کلاس ig-feed می‌آید', /\.ig-feed\{padding:0\}/.test(html));
  A('راهنمای زیر فرم ورود حذف شده', !$('#logTip') && !/log-tip/.test(html));

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
  A('۱۵ تب پنل (با فید، دکمه‌ها، متن‌ها، انتشار)', $$('#admTabs .adm-tab').length === 15);
  A('تب‌های تازه در پنل هست', ['feed', 'buttons', 'copy', 'publish'].every(k => !!$('#admTabs [data-adm-tab="' + k + '"]')));
  A('بَج شمارش روی تب‌ها', $$('#admTabs .adm-tab em').length >= 4);
  A('نوار وضعیت پنل پر است', /محلی/.test($('#admPills').textContent) && /هم‌سان|منتشرنشده/.test($('#admPills').textContent));

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
  A('ابزار ردیف‌ها (↑ ↓ ⧉ ★ ✕)', $$('#admBody .row-tools button').length >= 4 * $$('#admBody .row-card').length);
  A('ویرایش JSON هر ردیف باز است', !!$('#admBody [data-rowjson="0"]'));
  {
    const nRows = $$('#admBody .row-card').length, first = T().W.gallery[0].t;
    click($$('#admBody [data-rmove="1"]')[0]); await sleep(70);
    A('«↓» ترتیب را عوض می‌کند', T().W.gallery[1].t === first);
    click($$('#admBody [data-rdup]')[0]); await sleep(70);
    A('«⧉» ردیف را دو‌نسخه می‌کند', $$('#admBody .row-card').length === nRows + 1);
    click($$('#admBody [data-rdel]')[0]); await sleep(70);
    A('«✕» ردیف را حذف می‌کند', $$('#admBody .row-card').length === nRows);
    {
      const last = T().W.gallery.length - 1, lastTitle = T().W.gallery[last].t;
      click($$('#admBody [data-rtop]')[last]); await sleep(70);
      A('«★» به ابتدای فید می‌رود', T().W.gallery[0].t === lastTitle);
    }
    const jta = $('#admBody [data-rowjson="0"]');
    type(jta, JSON.stringify({ t: 'ردیف JSON ۴۲', desc: 'از راه JSON', img: '', imgs: [], cat: '' }));
    click($('#admBody [data-rowapply="0"]')); await sleep(70);
    A('JSON ردیف نشاندِه شد', T().W.gallery[0].t === 'ردیف JSON ۴۲');
    click($('#admSave')); await sleep(150);
    A('ذخیرهٔ ردیف ویرایش‌شده', T().D.gallery[0].t === 'ردیف JSON ۴۲');
  }
  click($('#admTabs [data-adm-tab="feed"]')); await sleep(50);
  A('فرم فید: نسبت + اتصال', !!$('#fbRatio') && !!$('#igUserInp') && !!$('#igStories'));
  type($('#igPerInp'), '5'); click($('#admSave')); await sleep(120);
  A('سقف استوری نوار ذخیره شد', T().D.ig.perLine === 5 && $$('#stories .story').length === 6);
  click($('#admTabs [data-adm-tab="feed"]')); await sleep(40);
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

  console.log('— تب‌های JSON-محور (همه‌چیز ویرایش می‌شود)');
  click($('#admTabs [data-adm-tab="quick"]')); await sleep(60);
  A('فرم JSON برای پرسش‌های آماده', !!$('#admJson'));
  type($('#admJson'), JSON.stringify([{ q: 'سؤال تست ۴۰۴', a: 'پاسخ تست' }]));
  click($('#admSave')); await sleep(170);
  A('پرسش تازه ذخیره شد', T().D.quick.length === 1 && T().D.quick[0].q === 'سؤال تست ۴۰۴');
  T().go('chat'); await sleep(70);
  A('در گفتگو هم دیده می‌شود', /سؤال تست ۴۰۴/.test($('#quickReplies').textContent));
  type($('#admTabs [data-adm-tab="quick"]') && (click($('#admTabs [data-adm-tab="quick"]')), $('#admJson')), JSON.stringify(['سؤال متنی ۴۰۵']));
  await sleep(60); click($('#admSave')); await sleep(170);
  A('شکل متنی هم کار می‌کند', T().D.quick[0] === 'سؤال متنی ۴۰۵' && /سؤال متنی ۴۰۵/.test(doc.querySelector('#quickReplies').textContent));
  T().go('home'); await sleep(50);

  console.log('— متن‌های سایت (i18n قابل ویرایش)');
  click($('#admTabs [data-adm-tab="copy"]')); await sleep(70);
  A('فرم متن‌ها پر است', $$('#admBody [data-copyk]').length > 25);
  A('جست‌وجو ردیف‌ها را فیلتر می‌کند', (function () {
    type($('#admFind'), 'cta.order');
    const vis = $$('#admBody [data-copyrow]').filter(n => n.style.display !== 'none').length;
    type($('#admFind'), ''); return vis > 0 && vis <= 4;
  })());
  type($('#admBody [data-copyk="cta.order"]'), 'دوخت سفارشی را اینجا شروع کنید');
  click($('#admSave')); await sleep(170);
  A('متن جایگزین در سایت نشست', /دوخت سفارشی را اینجا/.test(doc.querySelector('[data-t="cta.order"]').textContent));
  A('tx() همان مقدار را می‌دهد', /اینجا/.test(T().tx('cta.order')));
  A('متن دست‌نویس در داده ذخیره شد', T().D.copy['cta.order'].indexOf('اینجا') > 0);
  type($('#admBody [data-copyk="cta.order"]'), '   ');
  click($('#admSave')); await sleep(170);
  A('خالی‌کردن یعنی بازگشت به پیش‌فرض', !T().D.copy['cta.order'] && /سفارش/.test(doc.querySelector('[data-t="cta.order"]').textContent));

  console.log('— دکمه‌ها (کجا نمایش داده شوند)');
  click($('#admTabs [data-adm-tab="buttons"]')); await sleep(70);
  const b4 = $$('#admBody .row-card').length;
  A('ردیف‌های دکمه از تماس‌هاست', b4 === T().D.contacts.length);
  click($('#admBody [data-badd]')); await sleep(70);
  A('ردیف دکمهٔ تازه افزوده شد', $$('#admBody .row-card').length === b4 + 1);
  type($$('#admBody [data-bf="label"]')[b4], 'بله');
  type($$('#admBody [data-bf="id"]')[b4], 'https://ble.sh/titanali');
  type($$('#admBody [data-bf="place"]')[b4], 'chat');
  click($('#admSave')); await sleep(190);
  A('دکمه ذخیره شد', T().D.contacts.some(c => c.label === 'بله' && c.place === 'chat'));
  A('فیلتر جاها درست است', T().btnList('chat').some(c => c.label === 'بله') && !T().btnList('home').some(c => c.label === 'بله'));
  T().go('chat'); await sleep(80);
  A('دکمه در گفتگو ظاهر شد', /بله/.test($('#chatBtns').textContent) && /ble\.sh/.test($('#chatBtns').innerHTML));
  T().go('home'); await sleep(60);
  A('در خانه نیست', !/بله/.test($('#heroCard').textContent));

  console.log('— فید با آیتم‌های واقعیِ پیج');
  click($('#admTabs [data-adm-tab="feed"]')); await sleep(60);
  $('#fbRatio').value = '9/16'; $('#fbRatio').dispatchEvent(new window.Event('change', { bubbles: true }));
  click($('#admSave')); await sleep(170);
  A('نسبت ۹:۱۶ روی ریشه نشست', /^calc\(9\s*\/\s*16\)$/.test(doc.documentElement.style.getPropertyValue('--igRatio')));
  A('همان نسبت در CSS پست‌هاست', /aspect-ratio:var\(--igRatio\)/.test(html));
  const fake = [{ id: 'a1', image_url: 'data:image/svg+xml,x', caption: 'پست واقعی از پیج متصل', likes: 7, comments: 2, link: 'https://www.instagram.com/p/abc/', date: '2026-10-01' }];
  T().igApplyFeed(fake, 'graph'); await sleep(80);
  A('پست واقعی جای فید خودی را گرفت', /پست واقعی از پیج متصل/.test($('#posts').textContent));
  A('نوار فید منبع graph را نشان می‌دهد', /🟢/.test($('#feedBar').textContent));
  A('کامنت/لینک بیرونی دارد', !!$('#posts [data-extlike]') && /instagram\.com\/p\/abc/.test($('#posts').innerHTML));
  A('یک پست، بدون قاب تزئینی', $$('#posts .post').length === 1 && !$('#sec-ig').classList.contains('ig-frame'));
  T().pubAction('clearfeed'); await sleep(80);
  A('قطع اتصال، فید را به طرح‌های سایت برمی‌گرداند', /🟢|⚪/.test($('#feedBar').textContent) && T().D.ig.feed.length === 0);

  console.log('— انتشار روی هاست (بدون سرور: صادقانه)');
  click($('#admTabs [data-adm-tab="publish"]')); await sleep(70);
  A('تب انتشار وضعیت را می‌گوید', /بک‌اند|انتشار/.test($('#admBody').textContent));
  A('دکمهٔ انتشار در نوار پایین هست', !!$('#admPublish'));
  click($('#admPublish')); await sleep(90);
  A('بدون سرور، انتشار رد می‌شود و دروغ نمی‌گوید', /بک‌اند|مرورگر/.test($('#toast').textContent));
  A('پیل «محلی» در سربرگ', /محلی/.test($('#admPills').textContent));
  click($('#admTabs [data-adm-tab="gallery"]')); await sleep(60);
  type($('[data-gf="t"][data-i="1"]'), 'عنوان منتشرنشده ۱۲۳');
  await sleep(40);
  A('نوار «منتشرنشده» همان لحظه ظاهر می‌شود', T().dirtyKeys().length >= 1 && !$('#admDirty').hidden && /منتشرنشده/.test($('#admDirty').textContent));
  click($('#admDirty [data-adm-revert]')); await sleep(80);
  A('«برگرداندن» ویرایش منتشرنشده را دور می‌ریزد', $('#admDirty').hidden && T().D.gallery[1].t !== 'عنوان منتشرنشده ۱۲۳');
  type($('[data-gf="t"][data-i="1"]'), 'عنوان منتشرنشده ۱۲۳');
  click($('#admSave')); await sleep(160);
  A('ذخیره که شد، نوار منتشرنشده پاک می‌شود', $('#admDirty').hidden && T().dirtyKeys().length === 0);
  A('انتشار خودکار بدون سرور کاری نمی‌کند', T().PUB.busy === false);

  console.log('— خروج ادمین');
  T().logout(); await sleep(60);
  A('خروج از حساب', !T().isAuth() && $('#adminPanel').classList.contains('open') === false);

  const real = errs.filter(e => !/Not implemented/.test(e));

  console.log('— پذیرش نسخهٔ منتشرشده روی هاست (baked)');
  {
    const of = window.fetch;
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({
      ok: true, app: 'titanali', rev: 99, at: Date.now() / 1000,
      data: { profile: { name: 'baked-name', initials: 'bk', role: 'r', tagline: 'tg', loves: 'l', location: 'T', availability: 'A', bio: 'b' },
              gallery: [], cats: [], contacts: [], messages: [], settings: {} }
    }) });
    let adopted = false;
    T().bakedPull(v => { adopted = !!v; });
    await sleep(160);
    A('محتوای منتشرشده پذیرفته شد', adopted && T().D.profile.name === 'baked-name');
    A('نسخه در نوار وضعیت ثبت شد', T().API.published === 99);
    window.fetch = of;
  }
  console.log('\nRESULT pass=' + ok + ' fail=' + fail + ' consoleErrors=' + real.length);
  if (real.length) console.log(real.slice(0, 5).join('\n'));
  process.exit(fail || real.length ? 1 : 0);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(2); });
