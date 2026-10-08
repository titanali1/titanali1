/* ============================================================
   AURORA GLASS — admin panel
   ============================================================ */
(function () {
  "use strict";
  const D = window.DMJ;
  const { $, $$, faNum, faDate, esc, icon, toast, uid } = D;

  let DATA = null;
  let TAB = "general";

  /* ---------------- path helpers ---------------- */
  const parsePath = (p) => p.replace(/\[(\d+)\]/g, ".$1").split(".");
  function getPath(obj, p) { return parsePath(p).reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, p, v) {
    const ks = parsePath(p); const last = ks.pop();
    const t = ks.reduce((o, k) => o[k], obj);
    t[last] = v;
  }

  /* ---------------- form primitives ---------------- */
  const field = (label, inner, span) => `<div class="field${span ? " span-2" : ""}"><span class="label">${esc(label)}</span>${inner}</div>`;
  const inp = (p, ph, type) => `<input class="input" type="${type || "text"}" data-p="${p}" value="${esc(getPath(DATA, p) ?? "")}" placeholder="${esc(ph || "")}">`;
  const ta = (p, ph) => `<textarea class="textarea" data-p="${p}" placeholder="${esc(ph || "")}">${esc(getPath(DATA, p) ?? "")}</textarea>`;
  const uploader = (p, wide) => `
    <button type="button" class="uploader${wide ? " uploader--wide" : ""}" data-up="${p}" title="برای انتخاب فایل کلیک کن">
      ${getPath(DATA, p) ? `<img src="${esc(getPath(DATA, p))}" alt="">` : ""}
      ${icon("upload")}
    </button>`;
  const sw = (p) => `<button type="button" class="switch" role="switch" data-p="${p}" aria-checked="${!!getPath(DATA, p)}"></button>`;
  const saveRow = (label) => `<div class="form-actions"><button class="btn btn--primary" data-save>${icon("save")} ${esc(label || "ذخیره تغییرات")}</button></div>`;
  const addBtn = (act, label) => `<button class="btn btn--sm" data-act="${act}">${icon("plus")} ${esc(label)}</button>`;
  const delBtn = (act, label) => `<button class="iconbtn btn--danger" data-act="${act}" title="${esc(label || "حذف")}" aria-label="${esc(label || "حذف")}">${icon("trash")}</button>`;
  const panel = (ic, title, inner) => `<section class="panel card"><div class="panel__head"><h2 class="panel__title">${icon(ic)} ${esc(title)}</h2></div>${inner}</section>`;

  /* ---------------- tabs ---------------- */
  const TABS = [
    { id: "general", title: "عمومی", icon: "user", group: "محتوا" },
    { id: "skills", title: "مهارت‌ها", icon: "spark", group: "محتوا" },
    { id: "portfolio", title: "نمونه‌کارها", icon: "briefcase", group: "محتوا" },
    { id: "projects", title: "پروژه‌ها", icon: "box", group: "محتوا" },
    { id: "gallery", title: "گالری", icon: "image", group: "محتوا" },
    { id: "music", title: "موسیقی", icon: "music", group: "محتوا" },
    { id: "socials", title: "شبکه‌ها / تماس‌ها", icon: "share", group: "محتوا" },
    { id: "messages", title: "پیام‌ها", icon: "inbox", group: "مدیریت" },
    { id: "settings", title: "تنظیمات", icon: "sliders", group: "مدیریت" },
    { id: "cloud", title: "فضای ابری (GitHub)", icon: "cloud", group: "مدیریت" },
    { id: "backup", title: "پشتیبان‌گیری", icon: "db", group: "مدیریت" }
  ];

  /* ---------------- tab renderers ---------------- */
  const R = {};

  R.general = () => `
    ${panel("user", "مشخصات پروفایل", `
      <div class="form-grid">
        ${field("نام", inp("profile.name"))}
        ${field("نقش / عنوان شغلی", inp("profile.role"))}
        ${field("شعار / علاقه‌مندی کوتاه (زیر اسم)", inp("profile.tagline"), true)}
        ${field("درباره من", ta("profile.about"), true)}
        ${field("آواتار (انتخاب فایل)", uploader("profile.avatar") + `<input class="input" data-p="profile.avatar" value="${esc(DATA.profile.avatar)}" placeholder="یا لینک تصویر">`, true)}
      </div>
      ${saveRow()}`)}
    ${panel("image", "تصویر زمینه سایت", `
      <div class="stack">
        ${uploader("appearance.background", true)}
        <p class="muted small">برای تصویر زمینه خالی، مقدار لینک را پاک کن و ذخیره بزن.</p>
        <div class="field">
          <span class="label">شفافیت تصویر زمینه: <b class="num" id="opVal">${faNum(DATA.appearance.bgOpacity)}</b>٪</span>
          <input class="range" type="range" min="0" max="100" data-p="appearance.bgOpacity" data-num value="${DATA.appearance.bgOpacity}">
        </div>
        <div class="form-grid">
          ${field("تم رنگی (لهجه)", `<select class="select" id="accentSel">${D.ACCENTS.map((a) => `<option value="${a.id}" ${D.getAppearance().accent === a.id ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select>`)}
          ${field("حالت روشن/تاریک", `<select class="select" id="themeSel"><option value="dark" ${D.getAppearance().theme === "dark" ? "selected" : ""}>تاریک</option><option value="light" ${D.getAppearance().theme === "light" ? "selected" : ""}>روشن</option></select>`)}
        </div>
        ${saveRow("ذخیره تصویر زمینه")}
      </div>`)}
    ${panel("heart", "علاقه‌مندی‌ها", `
      <div class="rows">
        ${DATA.interests.map((it, i) => `
          <div class="rowitem">
            <div class="rowitem__head"><span class="rowitem__grip num">مورد ${faNum(i + 1)}</span>${delBtn("del-interest:" + i)}</div>
            <div class="form-grid">
              ${field("عنوان", inp(`interests[${i}].title`))}
              ${field("آیکون", `<select class="select" data-p="interests[${i}].icon">${["heart", "ball", "gamepad", "code", "music", "camera", "image", "globe", "star", "spark"].map((k) => `<option value="${k}" ${it.icon === k ? "selected" : ""}>${k}</option>`).join("")}</select>`)}
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-interest", "افزودن علاقه‌مندی")}${""}<button class="btn btn--primary" data-save>${icon("save")} ذخیره</button></div>`)}
  `;

  R.skills = () => `
    ${panel("spark", "گروه‌های مهارت", `
      <div class="rows">
        ${DATA.skills.map((g, gi) => `
          <div class="rowitem">
            <div class="rowitem__head">
              <span class="rowitem__grip">گروه مهارت</span>
              <div class="row"><input class="input" data-p="skills[${gi}].title" value="${esc(g.title)}" placeholder="نام گروه" style="max-width:220px">${delBtn("del-group:" + gi)}</div>
            </div>
            <div class="rows">
              ${g.items.map((it, ii) => `
                <div class="rowitem" style="background:transparent">
                  <div class="form-grid" style="grid-template-columns:1.4fr 1fr auto auto;align-items:end">
                    ${field("مهارت", inp(`skills[${gi}].items[${ii}].name`))}
                    ${field("سطح: <b class=\"num\">" + faNum(it.level) + "٪</b>", `<input class="range" type="range" min="0" max="100" data-p="skills[${gi}].items[${ii}].level" data-num value="${it.level}">`)}
                    <div style="padding-bottom:8px">${delBtn("del-skill:" + gi + "," + ii)}</div>
                  </div>
                </div>`).join("")}
            </div>
            <div class="form-actions">${addBtn("add-skill:" + gi, "افزودن مهارت")}</div>
          </div>`).join("") || '<div class="empty">' + icon("spark") + "<p>گروهی نیست.</p></div>"}
      </div>
      <div class="form-actions">${addBtn("add-group", "افزودن گروه")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره مهارت‌ها</button></div>`)}
  `;

  R.portfolio = () => `
    ${panel("briefcase", "نمونه‌کارها", `
      <div class="rows">
        ${DATA.portfolio.map((w, i) => `
          <div class="rowitem">
            <div class="rowitem__head"><span class="rowitem__grip num">مورد ${faNum(i + 1)}</span>${delBtn("del-work:" + i)}</div>
            <div class="form-grid">
              ${field("عنوان", inp(`portfolio[${i}].title`))}
              ${field("سال", inp(`portfolio[${i}].year`, "۱۴۰۳"))}
              ${field("توضیح", ta(`portfolio[${i}].desc`), true)}
              ${field("نوع", inp(`portfolio[${i}].type`, "وب‌سایت / ربات"))}
              ${field("وضعیت", inp(`portfolio[${i}].status`, "فعال"))}
              ${field("برچسب‌ها (با ویرگول)", inp(`portfolio[${i}].tags`, "Laravel, MySQL"))}
              ${field("لینک", inp(`portfolio[${i}].link`, "https://"))}
              ${field("تصویر کاور", uploader(`portfolio[${i}].cover`) + `<input class="input" data-p="portfolio[${i}].cover" value="${esc(w.cover || "")}" placeholder="یا لینک تصویر">`, true)}
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-work", "افزودن نمونه‌کار")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره نمونه‌کارها</button></div>`)}
  `;

  R.projects = () => `
    ${panel("box", "پروژه‌ها", `
      <div class="rows">
        ${DATA.projects.map((p, i) => `
          <div class="rowitem">
            <div class="rowitem__head"><span class="rowitem__grip num">پروژه ${faNum(i + 1)}</span>${delBtn("del-proj:" + i)}</div>
            <div class="form-grid">
              ${field("عنوان", inp(`projects[${i}].title`), true)}
              ${field("توضیح", ta(`projects[${i}].desc`), true)}
              ${field("برچسب‌ها (با ویرگول)", inp(`projects[${i}].tags`, "Python, Redis"))}
              ${field("لینک", inp(`projects[${i}].link`, "https://"))}
              ${field("فایل دانلود (لینک)", inp(`projects[${i}].file`, "اختیاری"), true)}
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-proj", "افزودن پروژه")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره پروژه‌ها</button></div>`)}
  `;

  R.gallery = () => `
    ${panel("image", "گالری تصاویر", `
      <div class="rows">
        ${DATA.gallery.map((g, i) => `
          <div class="rowitem">
            <div class="rowitem__head"><span class="rowitem__grip num">تصویر ${faNum(i + 1)}</span>${delBtn("del-shot:" + i)}</div>
            <div class="form-grid" style="grid-template-columns:auto 1fr">
              ${field("تصویر", uploader(`gallery[${i}].src`))}
              <div class="stack">
                ${field("لینک تصویر", inp(`gallery[${i}].src`, "assets/img/... یا https://"))}
                ${field("توضیح", inp(`gallery[${i}].caption`, "توضیح کوتاه"))}
              </div>
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-shot", "افزودن تصویر")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره گالری</button></div>`)}
  `;

  R.music = () => `
    ${panel("music", "آهنگ‌ها", `
      <div class="rows">
        ${DATA.music.map((t, i) => `
          <div class="rowitem">
            <div class="rowitem__head"><span class="rowitem__grip num">آهنگ ${faNum(i + 1)}</span>${delBtn("del-track:" + i)}</div>
            <div class="form-grid" style="grid-template-columns:auto 1fr 1fr">
              ${field("کاور", uploader(`music[${i}].cover`))}
              <div class="stack">
                ${field("عنوان", inp(`music[${i}].title`))}
                ${field("خواننده / هنرمند", inp(`music[${i}].artist`))}
              </div>
              <div class="stack">
                ${field("فایل صدا (لینک mp3)", inp(`music[${i}].src`, "اختیاری — خالی یعنی پیش‌نمایش"))}
                ${field("مدت (ثانیه، برای پیش‌نمایش)", inp(`music[${i}].duration`, "212", "number"))}
              </div>
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-track", "افزودن آهنگ")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره آهنگ‌ها</button></div>`)}
  `;

  R.socials = () => `
    ${panel("share", "شبکه‌های اجتماعی و راه‌های تماس", `
      <p class="muted small">💡 هر موردی که اینجا <b>روشن</b> بماند و آیدی داشته باشد، در صفحه‌ی «شبکه‌های اجتماعی» سایت نمایش داده می‌شود.</p>
      <div class="rows">
        ${DATA.socials.map((s, i) => `
          <div class="rowitem">
            <div class="rowitem__head">
              <span class="rowitem__grip">${icon(s.icon || "link")} ${esc(s.title)}</span>
              <div class="row" style="gap:10px"><span class="label">نمایش</span>${sw(`socials[${i}].on`)}</div>
            </div>
            <div class="form-grid">
              ${field("عنوان", inp(`socials[${i}].title`))}
              ${field("آیدی", inp(`socials[${i}].id`, "username"))}
              ${field("لینک", inp(`socials[${i}].url`, "https://"), true)}
            </div>
          </div>`).join("")}
      </div>
      <div class="form-actions">${addBtn("add-social", "افزودن شبکه")}<button class="btn btn--primary" data-save>${icon("save")} ذخیره شبکه‌ها و تماس‌ها</button></div>`)}
  `;

  let msgFilter = "all";
  R.messages = () => {
    const list = D.getMessages().filter((m) =>
      msgFilter === "all" ? true : msgFilter === "unread" ? m.state === "unread" : m.state === "replied");
    return panel("inbox", "پیام‌های دریافتی", `
      <div class="filters" role="group" aria-label="فیلتر پیام‌ها">
        ${[["all", "همه"], ["unread", "خوانده‌نشده"], ["replied", "پاسخ‌داده‌شده"]].map(([k, l]) =>
          `<button class="chip" data-act="msg-filter:${k}" aria-pressed="${msgFilter === k}">${esc(l)}</button>`).join("")}
      </div>
      <div class="rows">
        ${list.map((m) => `
          <div class="msg ${m.state === "unread" ? "msg--unread" : ""}">
            <div class="msg__head">
              <span class="msg__from">${esc(m.from)} ${m.contact ? `<span class="chip" dir="ltr">${esc(m.contact)}</span>` : ""}
                ${m.state === "unread" ? '<span class="badge badge--warn">خوانده‌نشده</span>' : m.state === "replied" ? '<span class="badge badge--ok">پاسخ‌داده‌شده</span>' : '<span class="badge">خوانده‌شده</span>'}</span>
              <span class="msg__date">${esc(faDate(m.date))}</span>
            </div>
            <p class="msg__body">${esc(m.body)}</p>
            <div class="msg__actions">
              <button class="btn btn--sm" data-act="msg-read:${m.id}">${icon("eye")} ${m.state === "unread" ? "خواندم" : "خوانده‌نشده"}</button>
              <button class="btn btn--sm" data-act="msg-replied:${m.id}">${icon("check")} پاسخ داده شد</button>
              ${delBtn("msg-del:" + m.id, "حذف پیام")}
            </div>
          </div>`).join("") || `<div class="empty">${icon("inbox")}<p>پیامی در این دسته نیست.</p></div>`}
      </div>
      <div class="form-actions"><button class="btn btn--danger btn--sm" data-act="msg-clear">${icon("trash")} پاک‌کردن همه پیام‌ها</button></div>`);
  };

  R.settings = () => `
    ${panel("sliders", "مشخصات ورود و تنظیمات سایت", `
      <div class="form-grid">
        ${field("یوزرنیم مدیریت", inp("settings.adminUser"))}
        ${field("پسورد جدید مدیر", inp("settings.adminPass", "", "password"))}
        ${field("عنوان سایت (نوار بالایی)", inp("settings.siteTitle"))}
        ${field("آدرس سرویس فرم پیام (اختیاری)", inp("settings.formEndpoint", "https://api.web3forms.com/submit"))}
      </div>
      <p class="muted small">اگر آدرس سرویس فرم خالی بماند، فرم پیام در سایت غیرفعال می‌ماند و پیام‌ها فقط در همین مرورگر ذخیره می‌شوند.</p>
      ${saveRow("ذخیره تنظیمات")}`)}
  `;

  R.cloud = () => {
    const g = DATA.settings.github, sync = D.getSync();
    return panel("cloud", "فضای ابری مشترک (GitHub)", `
      <p class="muted small">با فعال‌کردن این بخش، هر تغییری که ذخیره کنی <b>بلافاصله برای همه‌ی بازدیدکننده‌ها</b> دیده می‌شود. توکن تو فقط در همین مرورگر ذخیره می‌شود و هرگز در سایت منتشر نمی‌شود.</p>
      <div class="form-grid">
        ${field("کاربری گیت‌هاب (owner)", inp("settings.github.owner"))}
        ${field("نام مخزن (repo)", inp("settings.github.repo"))}
        ${field("شاخه (branch)", inp("settings.github.branch"))}
        ${field("مسیر فایل داده", inp("settings.github.dataPath"))}
        ${field("مسیر فایل sync.json", inp("settings.github.syncPath"))}
        ${field("توکن گیت‌هاب — Fine-grained با دسترسی Contents: Read and write", inp("settings.github.token", "ghp_...", "password"))}
      </div>
      <div class="form-actions">
        <button class="btn" data-act="gh-test">${icon("link")} تست اتصال</button>
        <button class="btn btn--primary" data-act="gh-on">${icon("cloud")} فعال‌سازی همگام‌سازی</button>
        <button class="btn btn--danger" data-act="gh-off">${icon("x")} قطع همگام‌سازی</button>
      </div>
      <dl class="kv">
        <div class="kv__row"><dt>وضعیت همگام‌سازی</dt><dd>${sync && sync.on ? "روشن ✓" : "خاموش"}</dd></div>
        <div class="kv__row"><dt>آخرین همگام‌سازی</dt><dd>${sync && sync.at ? esc(faDate(sync.at)) : "—"}</dd></div>
      </dl>`);
  };

  R.backup = () => panel("db", "پشتیبان‌گیری و بارگذاری", `
    <div class="form-actions">
      <button class="btn" data-act="bk-export">${icon("download")} خروجی JSON</button>
      <button class="btn" data-act="bk-import">${icon("upload")} بازگردانی از JSON</button>
      <button class="btn btn--danger" data-act="bk-reset">${icon("refresh")} بازگشت به داده پیش‌فرض</button>
    </div>
    <input type="file" id="importFile" accept="application/json" hidden>
    <p class="muted small">خروجی شامل تمام محتوا و تنظیمات است (به‌جز توکن گیت‌هاب). فایل را می‌توانی بعداً روی هر دستگاه دیگری بازگردانی کنی.</p>`);

  /* ---------------- save / sync ---------------- */
  async function saveNow(label) {
    const ok = D.persistSite(DATA);
    if (!ok) return;
    const sync = D.getSync();
    if (sync && sync.on && DATA.settings.github.token) {
      try {
        await D.ghPut(DATA.settings.github, DATA.settings.github.dataPath, JSON.stringify(DATA, null, 2), "admin: update site data");
        D.setSync(Object.assign({}, sync, { at: new Date().toISOString() }));
        toast((label || "تغییرات") + " ذخیره و همگام شد ☁️");
        paintSync(); renderTab();
        return;
      } catch (e) { toast("همگام‌سازی ناموفق: " + e.message, "err"); return; }
    }
    toast((label || "تغییرات") + " ذخیره شد ✓");
  }
  function paintSync() {
    const sync = D.getSync();
    $("#syncPill").className = "pill" + (sync && sync.on ? " pill--on" : "");
    $("#syncTxt").textContent = sync && sync.on ? "همگام‌سازی روشن" : "همگام‌سازی خاموش";
  }

  /* ---------------- render ---------------- */
  function renderNav() {
    const groups = [...new Set(TABS.map((t) => t.group))];
    $("#sideNav").innerHTML = groups.map((g) =>
      `<span class="side__label">${esc(g)}</span>` +
      TABS.filter((t) => t.group === g).map((t) =>
        `<button class="side__btn" data-tab="${t.id}" aria-current="${TAB === t.id}">${icon(t.icon)} ${esc(t.title)}</button>`).join("")).join("");
  }
  function renderTab() {
    const t = TABS.find((x) => x.id === TAB);
    $("#mainTitle").innerHTML = icon(t.icon) + " " + esc(t.title);
    $("#panel").innerHTML = R[TAB]();
  }

  /* ---------------- bindings (delegated once) ---------------- */
  function bindTab() {
    const root = $("#panel");
    // live two-way binding
    root.addEventListener("input", onInput);
    root.addEventListener("change", onInput);
    root.addEventListener("click", onClick);
  }
  function onInput(e) {
    const el = e.target.closest("[data-p]");
    if (!el) return;
    let v = el.value;
    if (el.dataset.num !== undefined) v = Number(v);
    if (el.type === "number") v = Number(v);
    setPath(DATA, el.dataset.p, v);
    if (el.dataset.num !== undefined) {
      const lb = el.closest(".field") && el.closest(".field").querySelector(".label b");
      if (lb) lb.textContent = el.dataset.p === "appearance.bgOpacity" ? faNum(v) : faNum(v) + "٪";
    }
    if (el.dataset.p === "profile.avatar" || /\.cover$|\.src$|\.background$/.test(el.dataset.p)) {
      const up = $(`[data-up="${el.dataset.p}"]`);
      if (up) up.innerHTML = v ? `<img src="${esc(v)}" alt="">` : "" + icon("upload");
    }
  }
  function onClick(e) {
    const up = e.target.closest("[data-up]");
    if (up) return pickFile(up);
    const swb = e.target.closest(".switch[data-p]");
    if (swb) { const v = !getPath(DATA, swb.dataset.p); setPath(DATA, swb.dataset.p, v); swb.setAttribute("aria-checked", v); return; }
    const sv = e.target.closest("[data-save]");
    if (sv) return saveNow();
    const ac = e.target.closest("[data-act]");
    if (!ac) return;
    const [name, arg] = ac.dataset.act.split(":");
    const arg2 = arg && arg.includes(",") ? arg.split(",") : arg;
    act(name, arg2, ac);
  }

  function pickFile(btn) {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*,audio/*";
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      if (f.size > 1.6e6) { toast("حجم فایل زیاد است؛ بهتر است لینک بدهی.", "err"); }
      const rd = new FileReader();
      rd.onload = () => {
        setPath(DATA, btn.dataset.up, rd.result);
        btn.innerHTML = `<img src="${rd.result}" alt="">` + icon("upload");
        const twin = $(`[data-p="${btn.dataset.up}"]`); if (twin) twin.value = "(داده در فایل ذخیره شد)";
        toast("فایل بارگذاری شد — یادت نماند ذخیره بزنی.");
      };
      rd.readAsDataURL(f);
    };
    input.click();
  }

  function act(name, arg, btn) {
    const i = typeof arg === "string" ? +arg : arg;
    switch (name) {
      case "add-group": DATA.skills.push({ title: "گروه جدید", items: [{ name: "مهارت جدید", level: 70 }] }); break;
      case "del-group": DATA.skills.splice(i, 1); break;
      case "add-skill": DATA.skills[i].items.push({ name: "مهارت جدید", level: 70 }); break;
      case "del-skill": DATA.skills[+i[0]].items.splice(+i[1], 1); break;
      case "add-work": DATA.portfolio.push({ title: "نمونه‌کار جدید", desc: "", year: "1404", type: "", status: "فعال", tags: [], link: "", cover: "" }); break;
      case "del-work": DATA.portfolio.splice(i, 1); break;
      case "add-proj": DATA.projects.push({ title: "پروژه جدید", desc: "", tags: [], link: "", file: "" }); break;
      case "del-proj": DATA.projects.splice(i, 1); break;
      case "add-shot": DATA.gallery.push({ src: "", caption: "" }); break;
      case "del-shot": DATA.gallery.splice(i, 1); break;
      case "add-track": DATA.music.push({ title: "آهنگ جدید", artist: DATA.profile.name, cover: "", src: "", duration: 180 }); break;
      case "del-track": DATA.music.splice(i, 1); break;
      case "add-interest": DATA.interests.push({ title: "علاقه‌مندی جدید", icon: "heart" }); break;
      case "del-interest": DATA.interests.splice(i, 1); break;
      case "add-social": DATA.socials.push({ key: uid(), title: "شبکه جدید", id: "", url: "", icon: "link", color: "#7c5cff", on: true }); break;
      case "msg-filter": msgFilter = arg; renderTab(); return;
      case "msg-read": { const l = D.getMessages(); const m = l.find((x) => x.id === arg); if (m) m.state = m.state === "unread" ? "read" : "unread"; D.saveMessages(l); renderTab(); return; }
      case "msg-replied": { const l = D.getMessages(); const m = l.find((x) => x.id === arg); if (m) m.state = "replied"; D.saveMessages(l); renderTab(); return; }
      case "msg-del": D.saveMessages(D.getMessages().filter((x) => x.id !== arg)); renderTab(); return;
      case "msg-clear": if (confirm("همه پیام‌ها پاک شوند؟")) { D.saveMessages([]); renderTab(); } return;
      case "gh-test": return ghTest();
      case "gh-on": return ghOn();
      case "gh-off": D.setSync(null); paintSync(); renderTab(); toast("همگام‌سازی قطع شد."); return;
      case "bk-export": return exportJSON();
      case "bk-import": $("#importFile").click(); return;
      case "bk-reset": if (confirm("همه تغییرات محلی پاک و داده پیش‌فرض برگردد؟")) { D.resetSite(); location.reload(); } return;
    }
    renderTab();
  }

  async function ghTest() {
    const g = DATA.settings.github;
    if (!g.owner || !g.repo || !g.token) return toast("اول owner، repo و توکن را پر کن.", "err");
    try { await D.ghTest(g); toast("اتصال برقرار شد ✓"); }
    catch (e) { toast("اتصال ناموفق: " + e.message, "err"); }
  }
  async function ghOn() {
    const g = DATA.settings.github;
    try {
      await D.ghTest(g);
      D.setSync({ on: true, at: new Date().toISOString() });
      await D.ghPut(g, g.dataPath, JSON.stringify(DATA, null, 2), "admin: enable sync");
      paintSync(); renderTab(); toast("همگام‌سازی فعال شد ☁️");
    } catch (e) { toast("فعال‌سازی ناموفق: " + e.message, "err"); }
  }
  function exportJSON() {
    const clone = JSON.parse(JSON.stringify(DATA));
    if (clone.settings && clone.settings.github) clone.settings.github.token = "";
    const blob = new Blob([JSON.stringify(clone, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "site-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("خروجی گرفته شد ⬇");
  }

  /* ---------------- auth & boot ---------------- */
  function showAuth() { $("#authView").hidden = false; $("#shell").hidden = true; }
  function showShell() { $("#authView").hidden = true; $("#shell").hidden = false; renderNav(); paintSync(); renderTab(); }

  async function boot() {
    if (boot.booted) return; boot.booted = true;
    D.injectSprite();
    D.applyAppearance(D.getAppearance());
    DATA = await D.loadData();
    bindTab();
    if (localStorage.getItem(D.AUTH_KEY) === "1") showShell(); else showAuth();
    const sp = $("#splash");
    if (sp) { sp.classList.add("is-done"); setTimeout(() => sp.remove(), 500); }

    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = $("#lgUser").value.trim(), p = $("#lgPass").value;
      if (u === DATA.settings.adminUser && p === DATA.settings.adminPass) {
        localStorage.setItem(D.AUTH_KEY, "1"); toast("خوش آمدی، " + u + " 👋"); showShell();
      } else toast("یوزرنیم یا پسورد اشتباه است.", "err");
    });
    $("#logoutBtn").addEventListener("click", () => { localStorage.removeItem(D.AUTH_KEY); showAuth(); toast("خارج شدی."); });

    $("#sideNav").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]"); if (!b) return;
      TAB = b.dataset.tab; renderNav(); renderTab(); closeSide();
    });
    $("#menuBtn").addEventListener("click", () => { $("#side").classList.add("is-open"); $("#scrim").hidden = false; });
    $("#scrim").addEventListener("click", closeSide);
    $("#panel").addEventListener("change", (e) => {
      if (e.target.id === "importFile") {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const json = JSON.parse(rd.result);
            DATA = D.deepMerge(D.DEFAULT_DATA, json);
            D.persistSite(DATA); renderTab(); toast("بازگردانی شد ✓");
          } catch (err) { toast("فایل JSON معتبر نیست.", "err"); }
        };
        rd.readAsText(f);
      }
      if (e.target.id === "accentSel") { D.setAppearance({ accent: e.target.value }); toast("تم رنگی عوض شد."); }
      if (e.target.id === "themeSel") { D.setAppearance({ theme: e.target.value }); toast("حالت نمایش عوض شد."); }
    });
  }
  function closeSide() { $("#side").classList.remove("is-open"); $("#scrim").hidden = true; }

  document.addEventListener("DOMContentLoaded", boot);
})();
