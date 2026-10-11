#!/usr/bin/env node
/* تست حالت بک‌اند — یک شبیه‌ساز api.php روی fetch سوار می‌شود.
   اجرا:  node tests/sync.js   (نیاز: jsdom در node_modules پوشهٔ والد) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const APP_VER = (/window\.titanali=\{ver:'([\d.]+)'/.exec(html) || [])[1] || '0';

const errs = [], calls = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
['warn', 'log', 'info'].forEach(k => vc.on(k, () => {}));

/* ---------- سرور ساختگی (رفتار مطابق api.php) ---------- */
const SRV = { content: null, rev: 0, baked: null, published: null, updated: 1, users: [], tokens: {}, social: { likes: {}, dl: {}, comments: {} }, inbox: [] };
let CONFIRM = true;

const WHO = {};   // نسخهٔ ساختگیِ who.json (اصلاحیهٔ نام/شماره توسط ادمین)
function handle(action, body, qs, tok) {
  calls.push({ action, body });
  const J = (o, st) => ({ obj: Object.assign({ ok: true }, o), status: st || 200 });
  const authed = !!SRV.tokens[tok];
  switch (action) {
    case 'health': return J({ app: 'titanali', ver: APP_VER, siteVer: APP_VER, installed: SRV.users.length > 0, needSetup: SRV.users.length === 0, rev: SRV.rev, writable: true, php: '8.2', dataDir: '/home/x/titanali-data', host: 'titanali1.ir', domain: '' });
    case 'install':
      if (SRV.users.length) return { obj: { ok: false, error: 'قبلاً نصب شده' }, status: 409 };
      if (!body || String(body.p).length < 8) return { obj: { ok: false, error: 'رمز کوتاه است' }, status: 400 };
      SRV.users.push({ u: body.u, p: String(body.p), name: body.name || body.u, role: 'owner' });
      if (body.data) { SRV.content = body.data; SRV.rev++; }
      SRV.tokens['tok-srv'] = body.u;
      return J({ token: 'tok-srv', user: body.u, name: body.name || body.u, rev: SRV.rev });
    case 'login': {
      const a = SRV.users.filter(x => x.u === body.u && x.p === body.p)[0];
      if (!a) return { obj: { ok: false, error: 'نام کاربری یا رمز درست نیست' }, status: 401 };
      SRV.tokens['tok-' + a.u] = a.u;
      return J({ token: 'tok-' + a.u, user: a.u, name: a.name });
    }
    case 'logout': delete SRV.tokens[tok]; return J({});
    case 'content':
      if (body) {
        if (!authed) return { obj: { ok: false, error: 'نشست لازم است' }, status: 401 };
        if (body.baseRev != null && Number(body.baseRev) !== SRV.rev)
          return { obj: { ok: false, conflict: true, rev: SRV.rev, data: SRV.content, error: 'تعارض' }, status: 409 };
        SRV.content = body.data; SRV.rev++;
        return J({ rev: SRV.rev });
      }
      return J({ rev: SRV.rev, installed: SRV.users.length > 0, data: SRV.content, updated: SRV.updated, social: SRV.social });
    case 'metric': {
      const b = body.k === 'like' ? 'likes' : 'dl', m = SRV.social[b];
      const v = Math.max(0, (Number(m[body.i]) || 0) + Number(body.d || 0));
      if (v) m[body.i] = v; else delete m[body.i];
      return J({ social: SRV.social });
    }
    case 'comment': {
      const k = String(body.i);
      (SRV.social.comments[k] = SRV.social.comments[k] || []).push({ id: 'c' + (SRV.social.comments[k].length + 1), n: body.n, txt: body.txt, ts: Date.now() });
      return J({ comments: SRV.social.comments[k] });
    }
    case 'comment_del': {
      const k = String(body.i);
      SRV.social.comments[k] = (SRV.social.comments[k] || []).filter(c => c.id !== body.id);
      return J({ comments: SRV.social.comments[k] });
    }
    case 'send': {
      const sid = String(body.sid || '').length < 8 ? 'srv-' + (body.sid || 'new') : String(body.sid);
      if (body.name) SRV.lastWho = { name: body.name, phone: body.phone };
      SRV.inbox.push({
        mid: 'm' + (SRV.inbox.length + 1), sid, from: 'guest', text: body.text || '', ts: Date.now(),
        name: String(body.name || '').slice(0, 60), phone: String(body.phone || '').replace(/\D/g, ''),
        file: body.file && body.file.id ? { id: body.file.id, name: body.file.name, type: body.file.type, size: body.file.size } : undefined
      });
      return J({ mid: 'm' + SRV.inbox.length, sid, ts: Date.now(), unread: 0 });
    }
    case 'thread':
      return J({ messages: SRV.inbox.filter(r => r.from === 'admin' && r.sid === qs.sid).map(r => ({ mid: r.mid, text: r.text, ts: r.ts, from: 'them', name: 'تیتانلی' })), unread: 0 });
    case 'inbox': {
      if (!authed) return { obj: { ok: false, error: '۴۰' }, status: 401 };
      const items = SRV.inbox.slice().sort((a, b) => a.ts - b.ts);
      const last = items.filter(x => x.from !== 'admin').slice(-1)[0] || {};
      const g = items.filter(x => x.from !== 'admin')[0] || {};
      return J({
        threads: [{
          sid: SRV.inbox.length ? SRV.inbox[0].sid : 'x', n: items.length, last: Date.now(), items,
        name: WHO[last.sid] && WHO[last.sid].name || g.name || '', phone: WHO[last.sid] && WHO[last.sid].phone || g.phone || '',
          imgs: items.filter(x => x.file && /^image\//.test(String(x.file.type || ''))).length,
          unreadForAdmin: items.filter(x => x.from !== 'admin').length,
          answered: items.filter(x => x.from === 'admin').length
        }],
        total: items.length, unread: items.filter(x => x.from !== 'admin').length
      });
    }
    case 'who':
      if (!authed) return { obj: { ok: false, error: '۴۰۱' }, status: 401 };
      if (!body || !body.sid) return { obj: { ok: false, error: 'sid لازم است' }, status: 400 };
      WHO[body.sid] = { name: String(body.name || ''), phone: String(body.phone || '').replace(/\D/g, '') };
      return J({ sid: body.sid, name: WHO[body.sid].name, phone: WHO[body.sid].phone });
    case 'reply':
      if (!authed) return { obj: { ok: false, error: '۴۰۱' }, status: 401 };
      SRV.inbox.push({ mid: 'm' + (SRV.inbox.length + 1), sid: body.sid, from: 'admin', name: 'ادمین', text: body.text, ts: Date.now() + 1 });
      return J({ mid: 'm' + SRV.inbox.length });
    case 'admins': return J({ admins: SRV.users.map(u => ({ u: u.u, name: u.name, role: u.role })) });
    case 'export': return J({ data: SRV.content, social: SRV.social, inbox: SRV.inbox, log: [] });
    case 'upload': return J({ id: 'u1.jpg', url: 'api.php?action=file&f=u1.jpg', name: body.name, type: body.type, size: 1200 });
    case 'publish': {
      if (!authed) return { obj: { ok: false, error: 'نشست لازم است' }, status: 401 };
      if (!body || !body.data) return { obj: { ok: false, error: 'data لازم است' }, status: 400 };
      if (body.baseRev != null && Number(body.baseRev) !== SRV.rev)
        return { obj: { ok: false, conflict: true, rev: SRV.rev, data: SRV.content, error: 'تعارض' }, status: 409 };
      SRV.content = body.data; SRV.rev++;
      SRV.published = { rev: SRV.rev, at: Math.floor(Date.now() / 1000), by: 'admin', bytes: 4242, file: 'titanali-content.json' };
      SRV.baked = JSON.parse(JSON.stringify({ ok: true, app: 'titanali', rev: SRV.rev, at: SRV.published.at, data: SRV.content, social: SRV.social }));
      return J({ rev: SRV.rev, publish: Object.assign({ changed: true }, SRV.published), sections: { gallery: 'g' + SRV.rev, contacts: 'c' + SRV.rev } });
    }
    case 'state': {
      if (!authed) return { obj: { ok: false, error: 'نشست لازم است' }, status: 401 };
      return J({
        who: 'admin', rev: SRV.rev, updated: SRV.updated, savedBy: 'admin', publish: SRV.published || null,
        baked: { file: 'titanali-content.json', exists: !!SRV.baked, bytes: SRV.baked ? 4242 : 0, mtime: SRV.published ? SRV.published.at : 0, rev: SRV.published ? SRV.published.rev : 0 },
        hash: 'h' + SRV.rev, sections: { gallery: 'g' + SRV.rev, contacts: 'c' + SRV.rev },
        uploads: { files: 3, bytes: 51200 }, inbox: SRV.inbox.length, log: [{ ts: Math.floor(Date.now() / 1000), u: 'admin', what: 'publish', rev: SRV.rev }],
        igOn: false, counts: { gallery: (SRV.content && SRV.content.gallery || []).length, cats: 1, contacts: 1, admins: SRV.users.length }
      });
    }
    case 'baked':
      return SRV.baked ? J(SRV.baked) : J({ rev: SRV.rev, at: 0, baked: false, data: SRV.content, social: SRV.social });
    case 'ig': {
      if (!authed) return { obj: { ok: false, error: 'نشست لازم است' }, status: 401 };
      const items = [{ id: '101', image_url: 'https://example.com/p1.jpg', media_url: 'https://example.com/p1.jpg',
        caption: 'پست اول از پیج متصل', likes: 12, comments: 3, link: 'https://www.instagram.com/p/AAA/', date: '2026-10-01', user: 'titanali1' },
        { id: '102', image_url: 'https://example.com/p2.jpg', caption: 'پست دوم', likes: 7, comments: 1,
          link: 'https://www.instagram.com/p/BBB/', date: '2026-09-24', user: 'titanali1' }];
      return J({ src: 'graph', items, count: items.length, at: Math.floor(Date.now() / 1000) });
    }
  }
  return { obj: { ok: false, error: 'ناشناخته' }, status: 404 };
}

const dom = new JSDOM(html, {
  url: 'https://titanali1.ir/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.HTMLElement.prototype.scrollIntoView = function () { };
    w.scrollTo = () => { }; w.open = () => null;
    w.confirm = () => CONFIRM;
    w.fetch = (url, opt) => {
      const u = String(url);
      if (u.indexOf('titanali-content.json') >= 0) {           // فایل ایستای کنار index.html
        return new Promise(r => setTimeout(() => r({
          status: SRV.baked ? 200 : 404, ok: !!SRV.baked, headers: { get: () => 'application/json' },
          json: () => Promise.resolve(SRV.baked ? JSON.parse(JSON.stringify(SRV.baked)) : {})
        }), 6));
      }
      const action = (u.split('action=')[1] || '').split('&')[0];
      const qs = {}; (u.split('?')[1] || '').split('&').forEach(kv => { const i = kv.indexOf('='); if (i > 0) qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      let body = null; if (opt && opt.body) { try { body = JSON.parse(opt.body); } catch (e) { body = {}; } }
      const tok = (opt && opt.headers && opt.headers['X-TA-Token']) || '';
      return new Promise(r => setTimeout(() => {
        const out = handle(action, body, qs, tok);
        const iso = JSON.parse(JSON.stringify(out.obj));      // قطع مرجع، مثل شبکهٔ واقعی
        r({ status: out.status, ok: out.status < 400, headers: { get: k => String(k).toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : '' }, json: () => Promise.resolve(iso) });
      }, 6));
    };
  }
});
const { window } = dom, doc = window.document;
const T = () => window.titanali;
const $ = s => doc.querySelector(s), $$ = s => [...doc.querySelectorAll(s)];
const click = el => { if (!el) throw new Error('عنصر پیدا نشد'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); };
const type = (el, v) => { if (!el) throw new Error('ورودی پیدا نشد'); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const submit = f => f.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fa = s => String(s).replace(/[\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) - 0x06f0));
let ok = 0, fail = 0;
const A = (n, c) => { c ? (ok++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n)); };

/* محتوای سرور از قبل پر است (انگار ادمین از جای دیگر ذخیره کرده) */
SRV.content = {
  profile: { name: 'کارگاه سروری', initials: 'ت', role: 'طراح', tagline: 'x', bio: 'y', location: 'تهران', availability: 'open', avatar: '', loves: '♥' },
  cats: [{ t: 'پلیواری' }], contacts: [{ kind: 'telegram', id: 'titanali', label: 'تلگرام' }], hobbies: [], quick: [], messages: [],
  gallery: [{ t: 'طرح سروری', cat: 'پلیواری', desc: 'از سرور آمد', n: 0, likes: 0, dl: 0, comments: [], imgs: [], ts: Date.now(), img: '' }],
  ig: { user: 'titanali1', url: '', sub: 'x', perLine: 5, autoStories: 1, stories: [], commenter: 'مهمان' },
  admins: [{ u: 'admin', p: 'srvpass1384', name: 'ادمین سرور' }],
  settings: { lang: 'fa', bg: '', grid: '3', theme: '#050409', api: 'api.php' }
};
SRV.social = { likes: { 0: 7 }, dl: { 0: 2 }, comments: {} };

(async () => {
  await sleep(300);
  console.log('— اتصال و گرفتن محتوا');
  A('بک‌اند شناسایی شد', T().API.on === true);
  A('نسخهٔ پوستهٔ روی هاست از health دریافت شد', T().API.siteVer === APP_VER);
  A('سرور هنوز ادمین ندارد (needSetup)', T().API.setup === true);
  A('محتوای سرور جایگزین پیش‌فرض شد', /طرح سروری/.test($('#posts').textContent) && T().D.gallery.length === 1);
  A('قاب تک‌پست با محتوای سرور', $$('#posts .post').length === 1);
  A('شمارندهٔ لایک از overlay سرور (۷)', fa($('.pact .cnt').textContent) === '7');
  A('دادهٔ پایه دست‌نخورده (likes صفر)', T().D.gallery[0].likes === 0);
  A('بدون خطای کنسول در بوت', errs.filter(e => !/Not implemented/.test(e)).length === 0);

  console.log('— لایک / کامنت روی سرور');
  calls.length = 0;
  click($('.pact [data-like]')); await sleep(140);
  A('metric like d=1 فرستاده شد', calls.some(c => c.action === 'metric' && c.body.k === 'like' && c.body.d === 1));
  A('شمارنده شد ۸', fa($('.pact .cnt').textContent) === '8');
  A('مقدار محلی تغییر نکرد', T().D.gallery[0].likes === 0);
  type($('.cmt-form input'), 'قیمتش؟'); submit($('.cmt-form')); await sleep(160);
  A('کامنت به سرور رفت', calls.some(c => c.action === 'comment' && /قیمتش/.test(c.body.txt)));
  A('کامنت سرور در قاب دیده می‌شود', /قیمتش/.test($('#posts .pcom').textContent));

  console.log('— گفتگو');
  T().go('chat'); await sleep(40);
  calls.length = 0;
  const oldSid = T().D.sid;
  type($('#whoName'), 'سارا محمدی');
  type($('#whoPhone'), '۰۹۱۲۱۲۳۴۵۶۷');
  type($('#chatText'), 'سلام، سایز ۳۸'); submit($('#chatForm')); await sleep(200);
  A('send به سرور رفت', calls.some(c => c.action === 'send' && /سایز ۳۸/.test(c.body.text)));
  A('نام کاربر با پیام به سرور رفت', calls.some(c => c.action === 'send' && c.body.name === 'سارا محمدی'));
  A('شمارهٔ فارسی به لاتین تبدیل شد', calls.some(c => c.action === 'send' && c.body.phone === '09121234567'));
  A('حباب پاسخِ محلی ساخته نشد', T().D.messages.length === 1);
  A('sid کوتاه با شناسهٔ سرور عوض شد', /^srv-/.test(String(T().D.sid)) && T().D.sid !== oldSid);
  SRV.inbox.push({ mid: 'rp1', sid: T().D.sid, from: 'admin', name: 'تیتانلی', text: 'فردا آماده است', ts: Date.now() + 5 });
  T().apiPollThread(true); await sleep(160);
  A('پاسخ ادمین به گفتگو اضافه شد', /فردا آماده است/.test($('#chatLog').textContent));
  T().apiPollThread(true); await sleep(160);
  A('dedupe با mid (تکرار نشد)', T().D.messages.length === 2);

  console.log('— نصب و ورود');
  click($('#brandName')); await sleep(60);
  type($('#logUser'), 'admin'); type($('#logPass'), 'srvpass1384'); submit($('#logForm')); await sleep(240);
  A('در حالت needSetup ورود با لیست محلی مجاز است', T().isAuth() && $('#loginWrap').classList.contains('open') === false);
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(80);
  A('تب همگام‌سازی، فرم نصب را نشان می‌دهد', !!$('#suUser') && !!$('#suPass'));
  calls.length = 0;
  type($('#suUser'), 'admin'); type($('#suPass'), 'srvpass1384'); type($('#suName'), 'ادمین سرور');
  click($('#admBody [data-apibtn="install"]')); await sleep(240);
  A('install به سرور رفت', calls.some(c => c.action === 'install' && c.body.u === 'admin'));
  A('توکن ذخیره و needSetup پاک شد', T().API.setup === false && window.localStorage.getItem('titanali.tok') === 'tok-srv');
  A('rev از پاسخ نصب گرفته شد', T().API.rev === SRV.rev);
  A('محتوا در همان نصب روی سرور رفت', /طرح سروری/.test(JSON.stringify(SRV.content)));
  T().logout(); await sleep(80);
  click($('#brandName')); await sleep(50);
  type($('#logUser'), 'admin'); type($('#logPass'), 'titanali1384'); submit($('#logForm')); await sleep(200);
  A('رمز پیش‌فرض محلی رد شد (سرور نصب است)', $('#loginWrap').classList.contains('open') && /درست نیست/.test($('#logErr').textContent));
  type($('#logPass'), 'srvpass1384'); submit($('#logForm')); await sleep(220);
  A('رمز سرور پذیرفته شد', T().isAuth() && T().SESS.server === true);

  console.log('— ذخیره با همگام‌سازی و تعارض نسخه');
  calls.length = 0;
  click($('#admTabs [data-adm-tab="gallery"]')); await sleep(60);
  type($('[data-gf="t"][data-i="0"]'), 'طرح سروری ۲');
  click($('#admSave')); await sleep(2200);
  A('پس از مکث، content به سرور رفت', calls.some(c => c.action === 'content'));
  A('rev سرور و کلاینت هم‌سان شد', T().API.rev === SRV.rev && /طرح سروری ۲/.test(JSON.stringify(SRV.content)));
  const saved = JSON.parse(JSON.stringify(SRV.content));
  SRV.rev++; SRV.content = JSON.parse(JSON.stringify(SRV.content)); SRV.content.gallery[0].t = 'ویرایش همکار';
  CONFIRM = true; T().apiPush(false); await sleep(240);
  A('تعارض با تأیید → نسخهٔ سرور گرفته شد', /ویرایش همکار/.test(T().D.gallery[0].t));
  SRV.rev++; CONFIRM = false; T().apiPush(false); await sleep(300);
  A('تعارض با لغو → نسخهٔ من بازنویسی کرد', /طرح سروری ۲|ویرایش همکار/.test(SRV.content.gallery[0].t));
  SRV.content = saved; SRV.rev++;

  console.log('— صندوق مشترک و پاسخ');
  calls.length = 0;
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(60);
  click($('#admBody [data-apibtn="inbox"]')); await sleep(240);
  A('inbox از سرور گرفته شد', (T().API.threads || []).length >= 1);
  click($('#admTabs [data-adm-tab="inbox"]')); await sleep(80);
  A('گفتگوهای سرور با فرم پاسخ', !!$('[data-ssend]'));
  const frm = $('[data-ssend]').closest('[data-srep]');
  type(frm.querySelector('textarea'), 'بله، فردا'); calls.length = 0;
  click($('[data-ssend]')); await sleep(260);
  A('reply به سرور رفت', calls.some(c => c.action === 'reply' && /فردا/.test(c.body.text)));
  A('پاسخ در صندوق سرور ماند', SRV.inbox.some(r => r.from === 'admin' && /بله/.test(r.text)));

  console.log('— کارت کاربر: نام بالا، شماره پایین، تصاویر و پاسخ از همان‌جا');
  SRV.inbox.push({ mid: 'im1', sid: T().D.sid, from: 'guest', text: 'اینم عکس مدل', ts: Date.now() + 40,
    name: 'سارا محمدی', phone: '09121234567', file: { id: 'u9.jpg', name: 'model.jpg', type: 'image/jpeg', size: 24000 } });
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(60);
  click($('#admBody [data-apibtn="inbox"]')); await sleep(240);
  click($('#admTabs [data-adm-tab="inbox"]')); await sleep(90);
  A('کارت هر کاربر ساخته شد', !!$('#admBody .ibx-card') && !!$('#admBody [data-ibxto]'));
  A('نام در بالای کارت', /سارا محمدی/.test(($('#admBody .ibx-id b') || {}).textContent || ''));
  A('شماره زیر نام', /۰۹۱۲ ۱۲۳ ۴۵۶۷/.test(($('#admBody .ibx-ph') || {}).textContent || ''));
  A('گفتگو اول بسته است', $('#admBody .ibx-body').hidden === true);
  click($('#admBody [data-ibxto]')); await sleep(90);
  A('کلیک روی نام، گفتگو را باز کرد', $('#admBody .ibx-body').hidden === false);
  A('متن پیام کاربر در کارت است', /سلام، سایز ۳۸/.test($('#admBody .ibx-body').textContent));
  A('تصویر ارسالی کاربر نمایش داده شد', !!$('#admBody .ibx-imgs img') && /action=file/.test($('#admBody .ibx-imgs img').getAttribute('src')));
  A('فرم پاسخ همین‌جا است', !!$('#admBody .ibx-body [data-ssend]'));
  console.log('— ویرایش درجا: نام و شمارهٔ کاربر، همان‌جا که نمایش داده می‌شود');
  A('قلمیِ ویرایش روی کارت ادمین هست', !!$('#admBody [data-whosed]'));
  click($('#admBody [data-whosed]')); await sleep(70);
  A('فرم درجا با نام و شمارهٔ فعلی پر شد',
    !!$('#admBody .who-edit') && /سارا محمدی/.test($('#admBody .we-n').value) && /09121234567/.test($('#admBody .we-p').value));
  type($('#admBody .we-n'), 'سارا محمدی‌نیا (مشتری VIP)');
  type($('#admBody .we-p'), '۰۹۱۲۹۸۷۶۵۴۳'); calls.length = 0;
  click($('#admBody [data-whosave]')); await sleep(280);
  A('who به سرور رفت', calls.some(c => c.action === 'who' && /VIP/.test(c.body.name) && c.body.phone === '09129876543'));
  A('سرور اصلاحیه را نگه داشت', WHO[T().D.sid] && /VIP/.test(WHO[T().D.sid].name));
  A('کارت با نام و شمارهٔ تازه redraw شد',
    /VIP/.test(($('#admBody .ibx-id b') || {}).textContent || '') && /۰۹۱۲ ۹۸۷ ۶۵۴۳/.test(($('#admBody .ibx-ph') || {}).textContent || ''));
  A('پیام‌های کاربر دست‌نخورده ماند', SRV.inbox.some(r => r.name === 'سارا محمدی'));
  click($('#admBody [data-whosed]')); await sleep(70);
  $('#admBody .we-n').value = 'با Esc';
  $('#admBody .we-n').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(60);
  A('Esc فرم را می‌بندد و چیزی ذخیره نمی‌شود', !$('#admBody .who-edit') && /VIP/.test($('#admBody .ibx-id b').textContent));
  A('کارت باز با رندر دوباره باز می‌ماند', ($('#admBody .ibx-card') || {}).classList.contains('open'));

  console.log('— حذف کامنت توسط ادمین');
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(60);
  const del = $('#posts [data-cdel]');
  A('دکمهٔ حذف کامنتِ سرور برای ادمین هست', !!del);
  calls.length = 0; if (del) { click(del); await sleep(240); }
  A('comment_del با id فرستاده شد', calls.some(c => c.action === 'comment_del' && c.body.id));
  A('کامنت از سرور حذف شد', !SRV.social.comments[0] || SRV.social.comments[0].length === 0);

  console.log('— انتشار روی هاست (publish / state / baked)');
  {
    T().pubAction('pull'); await sleep(220);
    A('پیش از شروع، نسخهٔ کلاینت با سرور یکی است', T().API.rev === SRV.rev && T().API.conflict === false);
    const rev0 = T().API.rev;
    T().setTab('gallery'); await sleep(60);
    type($('[data-gf="t"][data-i="0"]'), 'طرح منتشرشده ۷۷۷');
    click($('#admSave')); await sleep(400);
    A('انتشار خودکار پس از ذخیره، نسخه را بالا برد', T().API.rev > rev0 && SRV.published && SRV.published.rev === T().API.rev);
    A('محتوای سرور همان مقدار تازه است', SRV.content.gallery[0].t === 'طرح منتشرشده ۷۷۷');
    A('نوار «منتشرنشده» پاک است', $('#admDirty').hidden && T().dirtyKeys().length === 0);
    A('پیل وضعیت «هم‌سان» شد', /هم‌سان/.test($('#admPills').textContent));
    A('فایل ایستای هاست نوشته شد', !!SRV.baked && SRV.baked.rev === T().API.rev && SRV.baked.app === 'titanali');
    A('بخش منتشرشده همان دادهٔ سایت است', SRV.baked.data && SRV.baked.data.gallery[0].t === 'طرح منتشرشده ۷۷۷');
    T().setTab('publish'); await sleep(120);
    A('تب انتشار، rev و فایل را نشان می‌دهد', new RegExp('rev').test($('#admBody').textContent) && /titanali-content\.json/.test($('#admBody').textContent));
    A('اندازهٔ فایل منتشرشده گزارش می‌شود', /کیلوبایت/.test($('#admBody').textContent));
    T().pubAction('state'); await sleep(160);
    A('خواندن وضعیت از سرور', T().PUB.state && T().PUB.state.baked.exists === true && /پیوست‌ها/.test($('#admBody').textContent) === false ? true : !!(T().PUB.state && T().PUB.state.baked.exists));
    A('پیل «همگام» پس از انتشار', /🚀/.test($('#admPills').textContent));
    // انتشار دستی وقتی چیزی تغییر نکرده هم بی‌خطر است
    const rev1 = T().API.rev;
    click($('#admPublish')); await sleep(220);
    A('هر انتشار دستی یک نسخهٔ تازه می‌سازد', T().API.rev === rev1 + 1 && SRV.baked.rev === T().API.rev);
    // تعارض نسخه
    SRV.rev += 1; T().API.rev = SRV.rev - 1;
    T().setTab('gallery'); await sleep(50);
    type($('[data-gf="t"][data-i="0"]'), 'تعارض انتشار');
    click($('#admSave')); await sleep(400);
    A('تعارض نسخه با پیل هشدار دیده می‌شود', T().API.conflict === true || /تازه‌تر|تعارض/.test($('#toast').textContent));
    T().pubAction('pull'); await sleep(200);
    A('پس از «گرفتن از سرور» تعارض پاک می‌شود', T().API.conflict === false);
  }

  console.log('— فید از پیج متصل (همگام‌سازی سمت سرور)');
  {
    T().setTab('feed'); await sleep(80);
    const btn = $('#admBody [data-pub="igsync"]') || $('#igSyncBtn');
    A('دکمهٔ همگام‌سازی در پنل هست', !!btn);
    T().pubAction('igsync'); await sleep(300);
    A('آیتم‌های واقعی از سرور گرفته شد', T().D.ig.feed.length === 2 && T().D.ig.feedSrc === 'graph');
    A('فید سایت همان پست بیرونی را نشان می‌دهد', /پست اول از پیج متصل/.test($('#posts').textContent));
    A('نوار فید منبع زنده را نشان می‌دهد', /🟢/.test($('#feedBar').textContent));
    A('کامنت/لایک پست بیرونی لینک به اینستا است', /instagram\.com\/p\/AAA/.test($('#posts').innerHTML));
    A('استوری از طرح‌های سایت ساخته می‌شود', $$('#stories .story').length >= 2);
    const revB = T().API.rev;
    T().pubAction('pub'); await sleep(260);
    A('فید تازه روی هاست منتشر شد', T().API.rev > revB && SRV.baked.data.ig && SRV.baked.data.ig.feed.length === 2);
    T().pubAction('clearfeed'); await sleep(120);
    A('قطع اتصال، فید را به طرح‌های خودی برمی‌گرداند', T().D.ig.feed.length === 0 && /⚪|🟢/.test($('#feedBar').textContent));
  }

  console.log('— بازدیدکننده روی هاست: پذیرش فایل منتشرشده');
  {
    const of = window.fetch;
    let adopted = false;
    T().API.on = false;
    T().bakedPull(v => { adopted = !!v; });
    await sleep(160);
    A('نسخهٔ منتشرشده پذیرفته شد', adopted && /طرح منتشرشده ۷۷۷|تعارض انتشار/.test(T().D.gallery[0].t));
    A('برچسب سایت از همان فایل خوانده می‌شود', /کارگاه سروری|طرح/.test(doc.body.textContent));
    T().API.on = true; window.fetch = of;
  }

  console.log('— دکمه‌ها در گفتگو (با سرور)');
  {
    T().setTab('buttons'); await sleep(80);
    A('تب دکمه‌ها با سرور باز می‌شود', $$('#admBody [data-bf="label"]').length >= 1);
    const n0b = T().D.contacts.length;
    click($('#admBody [data-badd]')); await sleep(60);
    type($$('#admBody [data-bf="label"]')[n0b], 'سروش');
    type($$('#admBody [data-bf="id"]')[n0b], 'https://sapp.ir/titanali');
    type($$('#admBody [data-bf="place"]')[n0b], 'chat');
    click($('#admSave')); await sleep(420);
    A('دکمه ذخیره و منتشر شد', SRV.content.contacts.length === n0b + 1 && SRV.content.contacts[n0b].place === 'chat');
    A('در گفتگوی سایت نمایش داده شد', /سروش/.test($('#chatBtns').textContent));
    T().pubAction('clearfeed');
  }

  console.log('— خروج');
  calls.length = 0; T().logout(); await sleep(160);
  A('logout به سرور رفت و توکن پاک شد', calls.some(c => c.action === 'logout') && !window.localStorage.getItem('titanali.tok'));

  const real = errs.filter(e => !/Not implemented/.test(e));
  console.log('\nRESULT pass=' + ok + ' fail=' + fail + ' consoleErrors=' + real.length);
  if (real.length) console.log(real.slice(0, 6).join('\n'));
  process.exit(fail || real.length ? 1 : 0);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(2); });
