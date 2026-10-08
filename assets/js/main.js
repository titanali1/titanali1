/* ============================================================
   AURORA GLASS — public site (index)
   ============================================================ */
(function () {
  "use strict";
  const { $, $$, faNum, faDate, esc, icon, countLabel, mmss, toast, observeReveals } = window.DMJ;

  const SECTIONS = [
    { id: "home",      title: "عمومی",          icon: "home",      desc: "نمای کلی پروفایل" },
    { id: "skills",    title: "مهارت‌ها",        icon: "spark",     desc: "زبان‌ها، فریم‌ورک‌ها و ابزارها" },
    { id: "portfolio", title: "نمونه‌کارها",     icon: "briefcase", desc: "کارهای منتشرشده" },
    { id: "gallery",   title: "گالری تصاویر",    icon: "image",     desc: "تصاویر با توضیح" },
    { id: "music",     title: "موسیقی",          icon: "music",     desc: "آهنگ‌های موردعلاقه" },
    { id: "projects",  title: "پروژه‌ها",        icon: "box",       desc: "پروژه‌های اشتراک‌گذاشته‌شده" },
    { id: "interests", title: "علاقه‌مندی‌ها",   icon: "heart",     desc: "کارهایی که دوست دارم" },
    { id: "socials",   title: "شبکه‌های اجتماعی", icon: "share",     desc: "راه‌های ارتباطی" },
    { id: "contact",   title: "پیام مستقیم",     icon: "chat",      desc: "پیامت را بنویس" }
  ];
  const meta = (id, data) => ({
    skills: countLabel(data.skills.reduce((n, g) => n + g.items.length, 0)),
    portfolio: countLabel(data.portfolio.length),
    gallery: countLabel(data.gallery.length),
    music: countLabel(data.music.length),
    projects: countLabel(data.projects.length),
    interests: countLabel(data.interests.length),
    socials: countLabel(data.socials.filter((s) => s.id && s.on !== false).length),
    contact: "فرم پیام", home: ""
  })[id];

  let DATA = null;

  /* ---------- chrome ---------- */
  function renderChrome() {
    const p = DATA.profile, ap = window.DMJ.getAppearance();
    $("#brandName").textContent = DATA.settings.siteTitle || p.name;
    $("#brandSub").textContent = p.role;
    document.title = (DATA.settings.siteTitle || p.name) + " | پروفایل";

    $("#accentDots").innerHTML = window.DMJ.ACCENTS.map((a) =>
      `<button class="accents__dot" style="--d1:${a.d1};--d2:${a.d2}" data-accent="${a.id}" title="${esc(a.label)}" aria-label="تم رنگی ${esc(a.label)}" aria-pressed="${ap.accent === a.id}"></button>`).join("");
    $("#themeBtn").innerHTML = icon(ap.theme === "dark" ? "sun" : "moon");
    $("#themeBtn").setAttribute("aria-label", ap.theme === "dark" ? "حالت روشن" : "حالت تاریک");
    try { $("#yearChip").textContent = faNum(new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date())); } catch (e) {}

    const bg = DATA.appearance.background;
    const bgEl = $("#bgImg");
    if (bg) { bgEl.style.backgroundImage = `url("${bg}")`; bgEl.style.setProperty("--bg-opacity", (DATA.appearance.bgOpacity || 40) / 100); bgEl.style.opacity = ""; }
    else bgEl.style.backgroundImage = "none";
    document.documentElement.style.setProperty("--bg-opacity", (DATA.appearance.bgOpacity || 40) / 100);

    injectJSONLD();
  }
  function injectJSONLD() {
    let el = $("#jsonld");
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "jsonld"; document.head.appendChild(el); }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "Person",
      name: DATA.profile.name, alternateName: "dmj74.ir", jobTitle: DATA.profile.role,
      description: `پروفایل شخصی ${DATA.profile.name} — مهارت‌ها، نمونه‌کارها، پروژه‌ها و راه‌های ارتباطی.`
    });
  }

  /* ---------- dock ---------- */
  function renderDock(active) {
    $("#dockIn").innerHTML = SECTIONS.map((s) =>
      `<button class="dock__btn" data-view="${s.id}" aria-current="${active === s.id ? "page" : "false"}" title="${esc(s.title)}">${icon(s.icon)}<span>${esc(s.title)}</span></button>`).join("");
  }

  /* ---------- shared blocks ---------- */
  const head = (s, extra) => `
    <div class="sec-head reveal">
      <h2 class="sec-head__title">${icon(s.icon)}<span>${esc(s.title)}</span>${extra ? `<span class="badge">${esc(extra)}</span>` : ""}</h2>
      <p class="sec-head__desc">${esc(s.desc)}</p>
    </div>`;
  const back = () => `<a class="btn btn--ghost btn--sm view__back" href="#/">${icon("chevron")} بازگشت به خانه</a>`;
  const empty = (ic, txt) => `<div class="empty reveal">${icon(ic)}<p>${esc(txt)}</p></div>`;

  /* ---------- views ---------- */
  function viewHome() {
    const p = DATA.profile;
    const stats = [
      { n: DATA.portfolio.length, l: "نمونه‌کار" }, { n: DATA.projects.length, l: "پروژه" },
      { n: DATA.gallery.length, l: "تصویر گالری" }, { n: DATA.music.length, l: "آهنگ" }
    ];
    const socialChips = DATA.socials.filter((s) => s.id && s.on !== false).slice(0, 4).map((s) =>
      `<a class="chip chip--accent" href="${esc(s.url)}" target="_blank" rel="noopener">${icon(s.icon)}${esc(s.title)}</a>`).join("");
    return `
    <section class="hero wrap">
      <div class="hero__card card reveal">
        <div class="hero__avatar"><img src="${esc(p.avatar)}" alt="${esc(p.name)}"></div>
        <div class="hero__id">
          <div class="row row--wrap" style="gap:10px">
            <h1 class="hero__name grad-text">${esc(p.name)}</h1>
            <span class="hero__role">${icon("code")} ${esc(p.role)}</span>
          </div>
          <p class="hero__tagline">${esc(p.tagline)}</p>
          ${p.about ? `<p class="hero__about">${esc(p.about)}</p>` : ""}
          <div class="hero__cta">
            <a class="btn btn--primary" href="#/contact">${icon("send")} پیام مستقیم</a>
            <a class="btn" href="#/portfolio">${icon("briefcase")} نمونه‌کارها</a>
            <a class="btn btn--ghost" href="#/socials">${icon("share")} شبکه‌های اجتماعی</a>
          </div>
          <div class="hero__socials">${socialChips}</div>
        </div>
      </div>
      <div class="stats" style="margin-top:14px">
        ${stats.map((s, i) => `<div class="stat card reveal" style="transition-delay:${i * 70}ms"><span class="stat__num">${faNum(s.n)}</span><span class="stat__label">${esc(s.l)}</span></div>`).join("")}
      </div>
    </section>
    <section class="overview wrap">
      ${head({ title: "بخش‌های سایت", icon: "grid", desc: "روی هر بخش بزن تا صفحه‌ی کامل آن باز شود." })}
      <div class="tiles">
        ${SECTIONS.filter((s) => s.id !== "home").map((s, i) => `
          <a class="tile card card--hover reveal" style="transition-delay:${i * 55}ms" href="#/${s.id}">
            <span class="tile__icon">${icon(s.icon)}</span>
            <span class="tile__title">${esc(s.title)}</span>
            <span class="tile__meta">${esc(meta(s.id, DATA) || s.desc)}</span>
            <span class="tile__arrow">${icon("chevron", "flip")}</span>
          </a>`).join("")}
      </div>
    </section>`;
  }

  function viewSkills() {
    const s = SECTIONS[1];
    if (!DATA.skills.length || !DATA.skills.some((g) => g.items.length)) return `<div class="view wrap">${back()}${head(s)}${empty("spark", "هنوز مهارتی ثبت نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.skills.reduce((n, g) => n + g.items.length, 0)))}
      <div class="skill-groups">
        ${DATA.skills.map((g, gi) => `
          <div class="skill-group card reveal" style="transition-delay:${gi * 70}ms">
            <h3 class="skill-group__title">${icon("spark")} ${esc(g.title)}</h3>
            ${g.items.map((it) => `
              <div class="skill">
                <div class="skill__row"><span>${esc(it.name)}</span><span class="skill__pct">${faNum(it.level || 0)}٪</span></div>
                <div class="bar"><i class="bar__fill" data-w="${it.level || 0}"></i></div>
              </div>`).join("")}
          </div>`).join("")}
      </div></div>`;
  }

  function workCard(w, i) {
    return `
    <article class="work card card--hover reveal" style="transition-delay:${i * 60}ms">
      <div class="work__cover">
        ${w.cover ? `<img src="${esc(w.cover)}" alt="${esc(w.title)}" loading="lazy">` : ""}
        ${w.year ? `<span class="work__year">${esc(faNum(w.year))}</span>` : ""}
        ${w.status ? `<span class="work__status badge badge--ok">${esc(w.status)}</span>` : ""}
      </div>
      <div class="work__body">
        <h3 class="work__title">${esc(w.title)}</h3>
        <p class="work__desc">${esc(w.desc)}</p>
        <div class="work__tags">${(w.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        <div class="work__foot">
          ${w.link && w.link !== "#" ? `<a class="btn btn--sm" href="${esc(w.link)}" target="_blank" rel="noopener">${icon("external")} مشاهده</a>` : ""}
          ${w.file ? `<a class="btn btn--sm" href="${esc(w.file)}" download>${icon("download")} دانلود</a>` : ""}
        </div>
      </div>
    </article>`;
  }

  function viewPortfolio() {
    const s = SECTIONS[2];
    if (!DATA.portfolio.length) return `<div class="view wrap">${back()}${head(s)}${empty("briefcase", "هنوز نمونه‌کاری ثبت نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.portfolio.length))}<div class="cards">${DATA.portfolio.map(workCard).join("")}</div></div>`;
  }

  function viewProjects() {
    const s = SECTIONS[5];
    if (!DATA.projects.length) return `<div class="view wrap">${back()}${head(s)}${empty("box", "هنوز پروژه‌ای منتشر نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.projects.length))}
      <p class="muted small reveal" style="margin-top:-8px">پروژه‌هایی که مدیر سایت منتشر کرده است — فایل، لینک و توضیحات هر پروژه.</p>
      <div class="cards">${DATA.projects.map((p, i) => workCard(Object.assign({ cover: "", year: "", status: "" }, p), i)).join("")}</div></div>`;
  }

  function viewGallery() {
    const s = SECTIONS[3];
    if (!DATA.gallery.length) return `<div class="view wrap">${back()}${head(s)}${empty("image", "تصویری در گالری ثبت نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.gallery.length))}
      <div class="gallery">
        ${DATA.gallery.map((g, i) => `
          <button class="shot reveal" data-shot="${i}" style="transition-delay:${i * 45}ms">
            <img src="${esc(g.src)}" alt="${esc(g.caption || "")}" loading="lazy">
            ${g.caption ? `<span class="shot__cap">${esc(g.caption)}</span>` : ""}
          </button>`).join("")}
      </div></div>`;
  }

  function viewMusic() {
    const s = SECTIONS[4];
    if (!DATA.music.length) return `<div class="view wrap">${back()}${head(s)}${empty("music", "هنوز آهنگی ثبت نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.music.length))}
      <div class="music">
        ${DATA.music.map((t, i) => `
          <button class="track card card--hover reveal" data-track="${i}" style="transition-delay:${i * 60}ms">
            <span class="track__cover">${t.cover ? `<img src="${esc(t.cover)}" alt="">` : ""}</span>
            <span class="track__meta"><span class="track__title">${esc(t.title)}</span><span class="track__artist">${esc(t.artist || "")}</span></span>
            <span class="track__state"></span>
            <span class="track__play">${icon("play")}</span>
          </button>`).join("")}
      </div></div>`;
  }

  function viewInterests() {
    const s = SECTIONS[6];
    if (!DATA.interests.length) return `<div class="view wrap">${back()}${head(s)}${empty("heart", "هنوز علاقه‌مندی‌ای ثبت نشده است.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(DATA.interests.length))}
      <div class="interests">${DATA.interests.map((it, i) =>
        `<span class="interest card card--hover reveal" style="transition-delay:${i * 55}ms">${icon(it.icon || "heart")} ${esc(it.title)}</span>`).join("")}</div></div>`;
  }

  function viewSocials() {
    const s = SECTIONS[7];
    const list = DATA.socials;
    if (!list.length) return `<div class="view wrap">${back()}${head(s)}${empty("share", "هنوز هیچ شبکه‌ای آیدی ندارد.")}</div>`;
    return `<div class="view wrap">${back()}${head(s, countLabel(list.filter((x) => x.id).length))}
      <div class="socials">
        ${list.map((so, i) => {
          const on = !!so.id && so.on !== false;
          return `<a class="social card card--hover reveal ${on ? "" : "is-off"}" style="--sc:${esc(so.color || "#7c5cff")};transition-delay:${i * 50}ms"
            ${on ? `href="${esc(so.url || "#")}" target="_blank" rel="noopener"` : `href="#" aria-disabled="true"`}>
            <span class="social__icon">${icon(so.icon || "link")}</span>
            <span style="min-width:0"><span class="social__name">${esc(so.title)}</span><br><span class="social__id">${on ? "@" + esc(so.id) : "آیدی ثبت نشده"}</span></span>
          </a>`;
        }).join("")}
      </div>
      <p class="muted small reveal">کاشی‌های کم‌رنگ هنوز آیدی ندارند؛ مدیر سایت می‌تواند از پنل مدیریت اضافه‌شان کند.</p></div>`;
  }

  function viewContact() {
    const s = SECTIONS[8];
    const enabled = !!DATA.settings.formEndpoint;
    return `<div class="view wrap">${back()}${head(s)}
      <div class="contact">
        <form class="contact__form card reveal" id="msgForm" novalidate>
          <div class="field"><label class="label" for="mName">نام</label><input class="input" id="mName" name="name" placeholder="اسمت چیست؟" required></div>
          <div class="field"><label class="label" for="mContact">راه ارتباطی (اختیاری)</label><input class="input" id="mContact" name="contact" placeholder="تلگرام یا ایمیل"></div>
          <div class="field"><label class="label" for="mBody">پیام</label><textarea class="textarea" id="mBody" name="message" placeholder="هر پیامی بفرستی به دست ${esc(DATA.profile.name)} می‌رسد." required></textarea></div>
          <div class="form-actions">
            <button class="btn btn--primary" type="submit" ${enabled ? "" : "disabled"}>${icon("send")} ارسال پیام</button>
            <span class="muted small" id="msgState"></span>
          </div>
        </form>
        <aside class="contact__aside">
          <div class="contact__note card reveal">
            <h3 class="bold" style="font-size:14.5px">${icon("chat", "")} راه‌های ارتباطی</h3>
            ${DATA.socials.filter((x) => x.id && x.on !== false).map((so) => `<a class="row small" style="gap:8px" href="${esc(so.url)}" target="_blank" rel="noopener"><span style="color:${esc(so.color || "#7c5cff")}">${icon(so.icon)}</span> ${esc(so.title)} — <b dir="ltr">@${esc(so.id)}</b></a>`).join("") || '<span class="muted small">موردی ثبت نشده.</span>'}
          </div>
          ${enabled ? "" : `<div class="contact__note card reveal"><p class="muted small">ارسال پیام از خود سایت در حال حاضر فعال نیست — از راه‌های ارتباطی ثبت‌شده (تلگرام، واتساپ، ایمیل…) پیام بده. 🙂</p></div>`}
        </aside>
      </div></div>`;
  }

  const VIEWS = { home: viewHome, skills: viewSkills, portfolio: viewPortfolio, gallery: viewGallery, music: viewMusic, projects: viewProjects, interests: viewInterests, socials: viewSocials, contact: viewContact };

  /* ---------- router ---------- */
  function route() {
    const id = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
    const view = VIEWS[id] || viewHome;
    const sec = SECTIONS.find((s) => s.id === id) || SECTIONS[0];
    $("#app").innerHTML = view();
    renderDock(sec.id);
    document.title = `${DATA.settings.siteTitle || DATA.profile.name} | ${sec.title}`;
    observeReveals($("#app"));
    window.scrollTo(0, 0);
    if (id === "skills") requestAnimationFrame(() => $$(".bar__fill").forEach((b) => { b.style.width = b.dataset.w + "%"; }));
    if (id === "music") syncTrackUI();
    bindView(id);
  }

  function bindView(id) {
    if (id === "contact") bindContact();
    if (id === "gallery") $$(".shot").forEach((b) => b.addEventListener("click", () => openLightbox(+b.dataset.shot)));
    if (id === "music") $$(".track").forEach((b) => b.addEventListener("click", () => toggleTrack(+b.dataset.track)));
  }

  /* ---------- contact ---------- */
  function bindContact() {
    const form = $("#msgForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = { name: $("#mName").value.trim(), contact: $("#mContact").value.trim(), message: $("#mBody").value.trim() };
      if (!body.name || !body.message) { toast("نام و متن پیام را بنویس.", "err"); return; }
      window.DMJ.addMessage({ from: body.name, contact: body.contact, body: body.message });
      const ep = DATA.settings.formEndpoint;
      if (ep) {
        try {
          await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
        } catch (err) {}
      }
      form.reset();
      toast("پیامت ثبت شد؛ ممنون! 💜");
    });
  }

  /* ---------- lightbox ---------- */
  let shotIdx = 0;
  function openLightbox(i) {
    shotIdx = i; paintLightbox(); $("#lightbox").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeLightbox() { $("#lightbox").hidden = true; document.body.style.overflow = ""; }
  function paintLightbox() {
    const g = DATA.gallery[shotIdx];
    if (!g) return closeLightbox();
    $("#lbImg").src = g.src;
    $("#lbCap").textContent = (g.caption || "") + "  ·  " + faNum(shotIdx + 1) + " / " + faNum(DATA.gallery.length);
  }
  function stepLightbox(d) { shotIdx = (shotIdx + d + DATA.gallery.length) % DATA.gallery.length; paintLightbox(); }

  /* ---------- music player ---------- */
  const audio = new Audio();
  const P = { i: -1, playing: false, pos: 0, dur: 0, real: false, timer: null };
  function toggleTrack(i) {
    if (P.i === i) { P.playing ? pause() : play(); return; }
    P.i = i; P.pos = 0;
    const t = DATA.music[i];
    P.real = !!t.src;
    if (P.real) { audio.src = t.src; audio.play().catch(() => {}); }
    P.dur = P.real ? 0 : (t.duration || 200);
    play();
    showPlayer();
  }
  function play() {
    P.playing = true;
    if (P.real) audio.play().catch(() => {});
    clearInterval(P.timer);
    P.timer = setInterval(() => {
      if (!P.playing) return;
      if (P.real) { P.pos = audio.currentTime; P.dur = audio.duration || 0; if (audio.ended) nextTrack(); }
      else { P.pos += .5; if (P.pos >= P.dur) nextTrack(); }
      paintPlayer();
    }, 500);
    syncTrackUI(); paintPlayer();
  }
  function pause() { P.playing = false; if (P.real) audio.pause(); clearInterval(P.timer); syncTrackUI(); paintPlayer(); }
  function nextTrack() { const n = (P.i + 1) % DATA.music.length; toggleTrack(n); }
  function showPlayer() { $("#player").classList.add("is-on"); paintPlayer(); }
  function paintPlayer() {
    const t = DATA.music[P.i]; if (!t) return;
    $("#plTitle").textContent = t.title;
    $("#plTime").textContent = mmss(P.pos) + " / " + mmss(P.dur);
    $("#plFill").style.width = (P.dur ? (P.pos / P.dur) * 100 : 0) + "%";
    $("#plPlay").innerHTML = icon(P.playing ? "pause" : "play");
    const cov = $("#plCover"); cov.innerHTML = t.cover ? `<img src="${esc(t.cover)}" alt="">` : "";
  }
  function syncTrackUI() {
    $$(".track").forEach((el) => {
      const i = +el.dataset.track, on = i === P.i && P.playing;
      el.classList.toggle("is-playing", i === P.i && P.i > -1);
      el.querySelector(".track__play").innerHTML = icon(on ? "pause" : "play");
      el.querySelector(".track__state").innerHTML = on ? '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : "";
    });
  }

  /* ---------- boot ---------- */
  let booted = false;
  async function boot() {
    if (booted) return; booted = true;
    window.DMJ.injectSprite();
    window.DMJ.applyAppearance(window.DMJ.getAppearance());
    DATA = await window.DMJ.loadData();
    renderChrome();
    route();
    const sp = $("#splash");
    if (sp) { sp.classList.add("is-done"); setTimeout(() => sp.remove(), 600); }
    attachChrome();
  }

  function attachChrome() {
    window.addEventListener("hashchange", route);
    $("#dockIn").addEventListener("click", (e) => {
      const b = e.target.closest(".dock__btn"); if (!b) return;
      location.hash = "#/" + b.dataset.view;
    });
    $("#themeBtn").addEventListener("click", () => {
      window.DMJ.setAppearance({ theme: window.DMJ.getAppearance().theme === "dark" ? "light" : "dark" });
      renderChrome();
    });
    $("#accentDots").addEventListener("click", (e) => {
      const d = e.target.closest(".accents__dot"); if (!d) return;
      window.DMJ.setAppearance({ accent: d.dataset.accent });
      renderChrome();
    });
    addEventListener("scroll", () => $("#topbar").classList.toggle("is-stuck", scrollY > 10), { passive: true });

    $("#lbClose").addEventListener("click", closeLightbox);
    $("#lbPrev").addEventListener("click", () => stepLightbox(-1));
    $("#lbNext").addEventListener("click", () => stepLightbox(1));
    $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
    addEventListener("keydown", (e) => {
      if (!$("#lightbox").hidden) {
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowRight") stepLightbox(-1);
        if (e.key === "ArrowLeft") stepLightbox(1);
      }
    });

    $("#plPlay").addEventListener("click", () => (P.playing ? pause() : play()));
    $("#plNext").addEventListener("click", nextTrack);
    $("#plClose").addEventListener("click", () => { pause(); P.i = -1; $("#player").classList.remove("is-on"); syncTrackUI(); });
    $("#plSeek").addEventListener("click", (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const ratio = 1 - (e.clientX - r.left) / r.width; // RTL: progress grows right→left
      P.pos = window.DMJ.clamp(ratio, 0, 1) * P.dur;
      if (P.real) audio.currentTime = P.pos;
      paintPlayer();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
