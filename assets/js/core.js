/* ============================================================
   AURORA GLASS — core: utils, theme, data, storage, sync
   مشترک بین سایت عمومی و پنل مدیریت
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- tiny helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const FA = "۰۱۲۳۴۵۶۷۸۹";
  const faNum = (v) => String(v).replace(/\d/g, (d) => FA[+d]);
  const faDate = (iso) => {
    try {
      return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
    } catch (e) { return String(iso); }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const countLabel = (n) => (n ? faNum(n) + " مورد" : "هنوز خالی");
  const mmss = (sec) => {
    sec = Math.max(0, Math.round(sec || 0));
    return faNum(String(Math.floor(sec / 60)).padStart(2, "0")) + ":" + faNum(String(sec % 60).padStart(2, "0"));
  };

  /* ---------------- icon sprite ---------------- */
  const PATHS = {
    home: '<path d="M3 9.5 12 2l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 13 15 13 15 22"/>',
    spark: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="22,6 12,13 2,6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    play: '<polygon points="6 3.5 20 12 6 20.5 6 3.5"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    prev: '<polygon points="19 4 9 12 19 20 19 4"/><line x1="5" y1="5" x2="5" y2="19"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    gamepad: '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="4"/>',
    ball: '<circle cx="12" cy="12" r="10"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 2v5M4 9l4 1M20 9l-4 1M6.5 19l3-4.5M17.5 19l-3-4.5"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><polygon points="10 9 15 12 10 15 10 9"/>',
    telegram: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    instagram: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.2" y1="6.8" x2="17.21" y2="6.8"/>',
    twitter: '<path d="M4 4l7.2 9.3L4.4 20h2.4l5.5-5.4L16.8 20H20l-7.5-9.7L18.9 4h-2.4l-4.9 4.9L8 4z"/>',
    whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 9.5c0 4 2.5 6.5 6 6.5l1-1.7-2-1.1-1 .8c-1-.5-1.9-1.4-2.4-2.4l.8-1-1.1-2z"/>'
  };
  function injectSprite() {
    if ($("#__sprite")) return;
    const defs = Object.entries(PATHS).map(([k, d]) =>
      `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join("");
    const el = document.createElement("div");
    el.id = "__sprite";
    el.style.display = "none";
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${defs}</svg>`;
    document.body.prepend(el);
  }
  const icon = (name, cls) => `<svg class="icon ${cls || ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ---------------- theme ---------------- */
  const APPEAR_KEY = "dmj74.appearance.v1";
  const ACCENTS = [
    { id: "aurora", d1: "#7c5cff", d2: "#22d3ee", label: "شفق" },
    { id: "sunset", d1: "#ff4d8d", d2: "#ffb454", label: "غروب" },
    { id: "emerald", d1: "#10b981", d2: "#a3e635", label: "زمرد" },
    { id: "ocean", d1: "#38bdf8", d2: "#818cf8", label: "اقیانوس" }
  ];
  function getAppearance() {
    let a = {};
    try { a = JSON.parse(localStorage.getItem(APPEAR_KEY) || "{}"); } catch (e) {}
    return Object.assign({ theme: "dark", accent: "aurora" }, a);
  }
  function applyAppearance(ap) {
    document.documentElement.dataset.theme = ap.theme;
    document.documentElement.dataset.accent = ap.accent;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = ap.theme === "light" ? "#eef1f9" : "#060913";
  }
  function setAppearance(patch) {
    const ap = Object.assign(getAppearance(), patch);
    localStorage.setItem(APPEAR_KEY, JSON.stringify(ap));
    applyAppearance(ap);
    return ap;
  }

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    let host = $("#toasts");
    if (!host) { host = document.createElement("div"); host.id = "toasts"; host.className = "toasts"; document.body.appendChild(host); }
    const el = document.createElement("div");
    el.className = "toast toast--" + (type || "ok");
    el.innerHTML = icon(type === "err" ? "x" : "check") + "<span>" + esc(msg) + "</span>";
    host.appendChild(el);
    setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 320); }, 2600);
  }

  /* ---------------- reveal ---------------- */
  let io;
  function observeReveals(root) {
    if (!("IntersectionObserver" in window)) { $$(".reveal", root).forEach((n) => n.classList.add("is-in")); return; }
    io = io || new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: .12 });
    $$(".reveal:not(.is-in)", root).forEach((n) => io.observe(n));
  }

  /* ---------------- default data ---------------- */
  const DEFAULT_DATA = {
    profile: {
      name: "dmj74",
      role: "برنامه‌نویس",
      tagline: "عاشق فوتبال و گیم و برنامه‌نویسی",
      about: "❰ GOD IS WHIT ME ❱\nFind someone who changes your life, not your instagram bio .\n꧁ⒷⓇⒶⓏⒶ ⓋⒶⒸⒽⒾⒶ꧂",
      avatar: "assets/img/avatar.png"
    },
    appearance: { background: "assets/img/gallery-1.jpg", bgOpacity: 42 },
    skills: [
      { title: "بک‌اند", items: [
        { name: "PHP / Laravel", level: 90 }, { name: "Python / FastAPI", level: 82 },
        { name: "Django", level: 74 }, { name: "PostgreSQL / MySQL", level: 78 } ] },
      { title: "فرانت‌اند", items: [
        { name: "HTML / CSS", level: 92 }, { name: "JavaScript", level: 85 },
        { name: "React", level: 80 } ] },
      { title: "زیرساخت و ابزار", items: [
        { name: "Git / GitHub", level: 88 }, { name: "Docker", level: 68 },
        { name: "Redis", level: 65 }, { name: "Linux", level: 72 } ] }
    ],
    portfolio: [
      { title: "فروشگاه آنلاین", desc: "فروشگاه با درگاه پرداخت و پنل مدیریت.", year: "1403", type: "وب‌سایت", status: "فعال",
        tags: ["Laravel", "MySQL"], link: "#", cover: "assets/img/gallery-2.jpg" },
      { title: "ربات فروش تلگرام", desc: "ربات فروش و پشتیبانی خودکار.", year: "1402", type: "ربات", status: "فعال",
        tags: ["Python", "FastAPI"], link: "#", cover: "assets/img/gallery-3.jpg" }
    ],
    projects: [
      { title: "طراحی وب‌سایت", desc: "طراحی و توسعه کامل وب‌سایت، از بک‌اند تا رابط کاربری.", tags: ["PHP", "Laravel", "React"], link: "#", file: "" },
      { title: "ربات‌های تلگرامی", desc: "ربات‌های اتوماسیون، فروش و پشتیبانی.", tags: ["Python", "FastAPI", "Redis"], link: "#", file: "" },
      { title: "ربات‌های ترید و داشبورد مدیریتی", desc: "ربات معامله‌گر، پنل مدیریت و گزارش‌گیری لحظه‌ای.", tags: ["Python", "PostgreSQL", "Django"], link: "#", file: "" }
    ],
    gallery: [
      { src: "assets/img/gallery-1.jpg", caption: "شفق قطبی — والپیپر موردعلاقه" },
      { src: "assets/img/gallery-2.jpg", caption: "میز کار من در شب" },
      { src: "assets/img/gallery-3.jpg", caption: "شب‌های فوتبال" }
    ],
    music: [
      { title: "آهنگ جدید", artist: "dmj74", cover: "assets/img/music-cover.jpg", src: "", duration: 212 }
    ],
    interests: [
      { title: "فوتبال", icon: "ball" }, { title: "گیم", icon: "gamepad" },
      { title: "برنامه‌نویسی", icon: "code" }, { title: "موسیقی", icon: "music" }
    ],
    socials: [
      { key: "telegram", title: "تلگرام", id: "dmj74", url: "https://t.me/dmj74", icon: "telegram", color: "#2aabee" },
      { key: "instagram", title: "اینستاگرام", id: "dmj.74", url: "https://instagram.com/dmj.74", icon: "instagram", color: "#e1306c" },
      { key: "youtube", title: "یوتیوب", id: "dmj 74", url: "https://youtube.com/@dmj%2074", icon: "youtube", color: "#ff0033" },
      { key: "twitter", title: "ایکس (توییتر)", id: "dmj_74", url: "https://x.com/dmj_74", icon: "twitter", color: "#9aa4c4" },
      { key: "whatsapp", title: "واتساپ", id: "", url: "", icon: "whatsapp", color: "#25d366" }
    ],
    settings: {
      siteTitle: "dmj74",
      adminUser: "admin",
      adminPass: "admin123",
      formEndpoint: "",
      github: { owner: "", repo: "", branch: "main", dataPath: "data/site.json", mediaPath: "media/", syncPath: "sync.json", token: "" }
    }
  };

  /* ---------------- storage ---------------- */
  const SITE_KEY = "dmj74.site.v1";
  const AUTH_KEY = "dmj74.admin.v1";
  const MSG_KEY = "dmj74.messages.v1";
  const SYNC_KEY = "dmj74.sync.v1";

  function deepMerge(base, over) {
    if (Array.isArray(over)) return over;
    if (over && typeof over === "object") {
      const out = Object.assign({}, base);
      Object.keys(over).forEach((k) => { out[k] = deepMerge(base ? base[k] : undefined, over[k]); });
      return out;
    }
    return over === undefined ? base : over;
  }

  let cached = null;
  function localSite() {
    try { return JSON.parse(localStorage.getItem(SITE_KEY) || "null"); } catch (e) { return null; }
  }
  function persistSite(data) {
    cached = data;
    try { localStorage.setItem(SITE_KEY, JSON.stringify(data)); return true; }
    catch (e) { toast("حافظه مرورگر پر است — فایل‌ها را با لینک ذخیره کن.", "err"); return false; }
  }
  function resetSite() { localStorage.removeItem(SITE_KEY); cached = null; }

  async function loadData() {
    if (cached) return cached;
    const local = localSite();
    if (local) { cached = deepMerge(DEFAULT_DATA, local); return cached; }
    try {
      const res = await fetch("data/site.json", { cache: "no-store" });
      if (res.ok) { const json = await res.json(); cached = deepMerge(DEFAULT_DATA, json); return cached; }
    } catch (e) { /* file:// or offline */ }
    cached = deepMerge(DEFAULT_DATA, {});
    return cached;
  }

  /* ---------------- messages ---------------- */
  function getMessages() {
    try { return JSON.parse(localStorage.getItem(MSG_KEY) || "null") || seedMessages(); } catch (e) { return []; }
  }
  function seedMessages() {
    const seed = [{ id: uid(), from: "یک بازدیدکننده", contact: "", body: "سلام! قالب جدید سایتت خیلی خوشگل شده 🔥", date: new Date().toISOString(), state: "unread" }];
    localStorage.setItem(MSG_KEY, JSON.stringify(seed));
    return seed;
  }
  function saveMessages(list) { localStorage.setItem(MSG_KEY, JSON.stringify(list)); }
  function addMessage(m) { const list = getMessages(); list.unshift(Object.assign({ id: uid(), date: new Date().toISOString(), state: "unread" }, m)); saveMessages(list); return list; }

  /* ---------------- GitHub sync ---------------- */
  function getSync() { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); } catch (e) { return null; } }
  function setSync(v) { v ? localStorage.setItem(SYNC_KEY, JSON.stringify(v)) : localStorage.removeItem(SYNC_KEY); }
  const ghBase = (g) => `https://api.github.com/repos/${g.owner}/${g.repo}`;
  async function ghTest(g) {
    const res = await fetch(`${ghBase(g)}/contents/${g.dataPath}?ref=${g.branch}`, {
      headers: { Authorization: "Bearer " + g.token, Accept: "application/vnd.github+json" }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  async function ghPut(g, path, content, message) {
    let sha;
    try {
      const cur = await fetch(`${ghBase(g)}/contents/${path}?ref=${g.branch}`, { headers: { Authorization: "Bearer " + g.token } });
      if (cur.ok) sha = (await cur.json()).sha;
    } catch (e) {}
    const res = await fetch(`${ghBase(g)}/contents/${path}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + g.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ message: message || "update from dmj74 admin", branch: g.branch, content: btoa(unescape(encodeURIComponent(content))), sha })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* ---------------- export ---------------- */
  window.DMJ = {
    $, $$, faNum, faDate, esc, clamp, uid, countLabel, mmss, icon, injectSprite,
    ACCENTS, getAppearance, setAppearance, applyAppearance,
    toast, observeReveals, DEFAULT_DATA, deepMerge,
    loadData, persistSite, resetSite, localSite,
    getMessages, saveMessages, addMessage,
    getSync, setSync, ghTest, ghPut,
    AUTH_KEY
  };
})();
