#!/usr/bin/env node
/* تست حالت بک‌اند — یک شبیه‌ساز api.php روی fetch سوار می‌شود.
   اجرا:  node tests/sync.js   (نیاز: jsdom در node_modules پوشهٔ والد) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errs = [], calls = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
['warn', 'log', 'info'].forEach(k => vc.on(k, () => {}));

/* ---------- سرور ساختگی (رفتار مطابق api.php) ---------- */
const SRV = { content: null, rev: 0, updated: 1, users: [], tokens: {}, social: { likes: {}, dl: {}, comments: {} }, inbox: [] };
let CONFIRM = true;

function handle(action, body, qs, tok) {
  calls.push({ action, body });
  const J = (o, st) => ({ obj: Object.assign({ ok: true }, o), status: st || 200 });
  const authed = !!SRV.tokens[tok];
  switch (action) {
    case 'health': return J({ app: 'titanali', ver: '1.0.0', installed: SRV.users.length > 0, needSetup: SRV.users.length === 0, rev: SRV.rev, writable: true, php: '8.2', dataDir: '/home/x/titanali-data', host: 'titanali1.ir', domain: '' });
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
      SRV.inbox.push({ mid: 'm' + (SRV.inbox.length + 1), sid, from: 'guest', text: body.text || '', ts: Date.now() });
      return J({ mid: 'm' + SRV.inbox.length, sid, ts: Date.now(), unread: 0 });
    }
    case 'thread':
      return J({ messages: SRV.inbox.filter(r => r.from === 'admin' && r.sid === qs.sid).map(r => ({ mid: r.mid, text: r.text, ts: r.ts, from: 'them', name: 'تیتانلی' })), unread: 0 });
    case 'inbox':
      if (!authed) return { obj: { ok: false, error: '۴۰' }, status: 401 };
      return J({
        threads: [{ sid: SRV.inbox.length ? SRV.inbox[0].sid : 'x', n: SRV.inbox.length, last: Date.now(), items: SRV.inbox.slice(), unreadForAdmin: SRV.inbox.filter(x => x.from !== 'admin').length }],
        total: SRV.inbox.length, unread: SRV.inbox.filter(x => x.from !== 'admin').length
      });
    case 'reply':
      if (!authed) return { obj: { ok: false, error: '۴۰۱' }, status: 401 };
      SRV.inbox.push({ mid: 'm' + (SRV.inbox.length + 1), sid: body.sid, from: 'admin', name: 'ادمین', text: body.text, ts: Date.now() + 1 });
      return J({ mid: 'm' + SRV.inbox.length });
    case 'admins': return J({ admins: SRV.users.map(u => ({ u: u.u, name: u.name, role: u.role })) });
    case 'export': return J({ data: SRV.content, social: SRV.social, inbox: SRV.inbox, log: [] });
    case 'upload': return J({ id: 'u1.jpg', url: 'api.php?action=file&f=u1.jpg', name: body.name, type: body.type, size: 1200 });
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
      const u = String(url), action = (u.split('action=')[1] || '').split('&')[0];
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
  type($('#chatText'), 'سلام، سایز ۳۸'); submit($('#chatForm')); await sleep(200);
  A('send به سرور رفت', calls.some(c => c.action === 'send' && /سایز ۳۸/.test(c.body.text)));
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

  console.log('— حذف کامنت توسط ادمین');
  click($('#admTabs [data-adm-tab="sync"]')); await sleep(60);
  const del = $('#posts [data-cdel]');
  A('دکمهٔ حذف کامنتِ سرور برای ادمین هست', !!del);
  calls.length = 0; if (del) { click(del); await sleep(240); }
  A('comment_del با id فرستاده شد', calls.some(c => c.action === 'comment_del' && c.body.id));
  A('کامنت از سرور حذف شد', !SRV.social.comments[0] || SRV.social.comments[0].length === 0);

  console.log('— خروج');
  calls.length = 0; T().logout(); await sleep(160);
  A('logout به سرور رفت و توکن پاک شد', calls.some(c => c.action === 'logout') && !window.localStorage.getItem('titanali.tok'));

  const real = errs.filter(e => !/Not implemented/.test(e));
  console.log('\nRESULT pass=' + ok + ' fail=' + fail + ' consoleErrors=' + real.length);
  if (real.length) console.log(real.slice(0, 6).join('\n'));
  process.exit(fail || real.length ? 1 : 0);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(2); });
