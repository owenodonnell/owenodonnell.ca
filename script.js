(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     Shared page behaviour (home + project pages)
     ========================================================= */

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const toggle = $(".nav-toggle");
  const navLinks = $("#nav-links");

  // Header: shadow on scroll; on the home page it stays hidden over the intro
  const header = $(".site-header");
  const introSection = $("#intro");
  if (header) {
    const updateHeader = () => {
      header.classList.toggle("scrolled", window.scrollY > 8);
      if (introSection) {
        const past = introSection.getBoundingClientRect().bottom <= header.offsetHeight + 40;
        header.classList.toggle("is-visible", past);
        if (!past) closeMenu();
      }
    };
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader);
    window.addEventListener("load", updateHeader);
    updateHeader();
  }

  // Mobile menu
  function closeMenu() {
    if (!navLinks || !toggle) return;
    navLinks.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    $$("a", navLinks).forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
    document.addEventListener("click", (e) => {
      if (!navLinks.contains(e.target) && !toggle.contains(e.target)) closeMenu();
    });
  }

  // Active nav link for in-page sections
  const spyLinks = navLinks
    ? $$("a", navLinks).filter((a) => /^#.+/.test(a.getAttribute("href") || "") && !a.classList.contains("nav-cta"))
    : [];
  if (spyLinks.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = "#" + entry.target.id;
          spyLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === id));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    spyLinks
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean)
      .forEach((s) => spy.observe(s));
  }

  // Fade-in on scroll
  if ("IntersectionObserver" in window && !reduceMotion) {
    const targets = $$(
      ".section-title, .about-text, .title-block, .fact-card, .td, .exp-card, .project-card, .lead-card, .skill-group, .contact-links, .project-head, .project-hero-media, .project-detail-grid"
    );
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("visible");
          obs.unobserve(el);
          // Drop the reveal classes afterwards so hover transforms work normally
          setTimeout(() => el.classList.remove("reveal", "visible"), 700);
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((el) => {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  // Project images: the SVG concept illustration shows until a real photo exists at images/<name>.jpg
  $$(".project-media .photo").forEach((img) => {
    const media = img.closest(".project-media");
    const ok = () => { if (img.naturalWidth > 0) media.classList.add("has-photo"); };
    if (img.complete) ok();
    img.addEventListener("load", ok);
  });

  // Background joint frames draw themselves in when they scroll into view
  const decos = $$(".deco");
  if (decos.length && "IntersectionObserver" in window && !reduceMotion) {
    const dio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); dio.unobserve(e.target); } });
    }, { threshold: 0.15 });
    decos.forEach((d) => dio.observe(d));
  } else {
    decos.forEach((d) => d.classList.add("in-view"));
  }

  // Linkage dividers: pin joints turn with the scroll position
  if ($(".linkage") && !reduceMotion) {
    let rotTick = false;
    const setRot = () => {
      rotTick = false;
      document.documentElement.style.setProperty("--shaft-rot", (window.scrollY * 0.35).toFixed(1) + "deg");
    };
    window.addEventListener("scroll", () => { if (!rotTick) { rotTick = true; requestAnimationFrame(setRot); } }, { passive: true });
    setRot();
  }

  // Section headings: label the dimension line with the heading's drawn width in mm
  const titles = $$(".section-title");
  if (titles.length) {
    const PX_TO_MM = 25.4 / 96;
    titles.forEach((t) => {
      const v = document.createElement("span");
      v.className = "dim-val";
      v.setAttribute("aria-hidden", "true");
      t.appendChild(v);
    });
    const setDims = () => titles.forEach((t) => {
      const w = t.getBoundingClientRect().width;
      $(".dim-val", t).textContent = (w * PX_TO_MM).toFixed(1) + " mm";
    });
    setDims();
    window.addEventListener("resize", setDims);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setDims);
  }

  /* =========================================================
     Projects: horizontal scroller with arrow buttons + numbered pager
     ========================================================= */
  (function initProjectScroller() {
    const track = $("#project-track");
    if (!track) return;
    const cards = $$(".project-card", track);
    const btns = $$(".scroll-btn");
    const nums = $$("#track-pager .track-nums button");
    const current = $("#track-current");
    const fill = $("#track-line-fill");
    const behavior = reduceMotion ? "auto" : "smooth";
    let pending = null;      // index the user just clicked, held until the scroll settles
    let pendingTimer;

    const step = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return cards.length ? cards[0].getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    };
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    const cardLeft = (i) => {
      const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      return Math.min(maxScroll(), Math.max(0, cards[i].offsetLeft - track.offsetLeft - pad));
    };
    const nearest = () => {
      if (track.scrollLeft >= maxScroll() - 4) return cards.length - 1;
      let best = 0, bestD = Infinity;
      cards.forEach((_, i) => {
        const d = Math.abs(cardLeft(i) - track.scrollLeft);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };
    const setActive = (i) => {
      nums.forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
      if (current) current.textContent = String(i + 1).padStart(2, "0");
      if (fill) fill.style.setProperty("--p", ((i + 1) / cards.length).toFixed(3));
    };
    const update = () => {
      const max = maxScroll() - 2;
      btns.forEach((b) => {
        const dir = Number(b.dataset.dir);
        b.disabled = dir < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= max;
      });
      setActive(pending != null ? pending : nearest());
    };
    const goTo = (i) => {
      pending = i;
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pending = null; update(); }, 800);
      track.scrollTo({ left: cardLeft(i), behavior });
      update();
    };

    btns.forEach((b) =>
      b.addEventListener("click", () => {
        pending = null;
        track.scrollBy({ left: Number(b.dataset.dir) * step(), behavior });
      })
    );
    nums.forEach((b) => b.addEventListener("click", () => goTo(Number(b.dataset.index))));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { pending = null; track.scrollBy({ left: step(), behavior }); e.preventDefault(); }
      if (e.key === "ArrowLeft") { pending = null; track.scrollBy({ left: -step(), behavior }); e.preventDefault(); }
    });
    // A manual swipe or wheel cancels the clicked target
    ["pointerdown", "wheel", "touchstart"].forEach((ev) =>
      track.addEventListener(ev, () => { pending = null; }, { passive: true })
    );
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* =========================================================
     Experience: timing diagram (each row goes "high" while active)
     ========================================================= */
  (function initTimingDiagram() {
    const td = $("#timing");
    if (!td) return;
    const NS = "http://www.w3.org/2000/svg";
    const START = 2023, YEARS = 5, M = YEARS * 12;   // Jan 2023 → Dec 2027
    const HI = 10, LO = 44, H = 54;

    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const nowM = Math.min(M, Math.max(0,
      (now.getFullYear() - START) * 12 + now.getMonth() + (now.getDate() - 1) / dim));
    const pct = (m) => ((m / M) * 100).toFixed(3) + "%";
    const monthIndex = (str) => {
      const [y, mo] = str.split("-").map(Number);
      return (y - START) * 12 + (mo - 1);
    };

    $$(".td-row", td).forEach((row) => {
      const spans = row.dataset.spans.split(",").map((sp) => {
        const [a, b] = sp.split(":");
        return [monthIndex(a), b === "now" ? nowM : monthIndex(b) + 1];   // end month is inclusive
      }).sort((p, q) => p[0] - q[0]);

      let d = `M0 ${LO}`;
      let area = "";
      spans.forEach(([x0, x1]) => {
        d += ` H${x0} V${HI} H${x1} V${LO}`;
        area += `M${x0} ${HI} H${x1} V${LO} H${x0} Z `;
      });
      const last = spans[spans.length - 1];
      if (last[1] >= nowM - 1e-6) d = d.slice(0, d.lastIndexOf(" V"));   // still active: stay high at "now"
      else d += ` H${nowM}`;

      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", `0 0 ${M} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.innerHTML = `<path class="td-area" d="${area}"/><path class="td-wave" d="${d}"/>`;
      $(".td-signal", row).appendChild(svg);
    });

    const years = $(".td-years", td);
    const overlay = $(".td-overlay", td);
    for (let i = 0; i < YEARS; i++) {
      const y = document.createElement("span");
      y.className = "td-year";
      y.style.left = pct(i * 12 + 6);
      y.textContent = START + i;
      years.appendChild(y);
    }
    let html = "";
    for (let i = 1; i < YEARS; i++) html += `<span class="td-gridline" style="left:${pct(i * 12)}"></span>`;
    for (let m = 3; m < M; m += 3) if (m % 12) html += `<span class="td-tick" style="left:${pct(m)}"></span>`;
    html += `<span class="td-future" style="left:${pct(nowM)}"></span>`;
    html += `<span class="td-now" style="left:${pct(nowM)}"><span>NOW</span></span>`;
    overlay.innerHTML = html;

    // On narrow screens start the scroll near "now", where the recent activity is
    const scroller = $(".td-scroll", td);
    const settle = () => {
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      const inner = $(".td-inner", td);
      const lw = parseFloat(getComputedStyle(inner).getPropertyValue("--lw")) || 0;
      const plotW = inner.scrollWidth - lw;
      scroller.scrollLeft = lw + plotW * (nowM / M) - scroller.clientWidth * 0.75;
    };
    settle();
  })();

  /* =========================================================
     Intro: robot arm on a linear rail spells the name
     ========================================================= */
  (function initIntro() {
    const intro = $("#intro");
    const svg = $("#intro-svg");
    if (!intro || !svg) return;

    const stage = $(".intro-stage", intro);
    const skipBtn = $("#intro-skip");
    const replayBtn = $("#intro-replay");
    const hud = {
      rail: $("#hud-rail"), j1: $("#hud-j1"), j2: $("#hud-j2"), j3: $("#hud-j3"),
      tcp: $("#hud-tcp"), grip: $("#hud-grip"), task: $("#hud-task"),
    };

    const NS = "http://www.w3.org/2000/svg";
    const STORAGE_KEY = "oo-intro-played";
    const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    const GRIP_DY = 40;    // wrist centre -> top of the gripped letter
    const APPROACH = 56;   // clearance above a letter before descending
    const DEG = 180 / Math.PI;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const angDiff = (from, to) => {
      let d = (to - from) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };
    // Keep shoulder angles in one continuous band (seam points straight down, never used)
    const normA1 = (a) => {
      while (a > Math.PI / 2) a -= 2 * Math.PI;
      while (a <= -1.5 * Math.PI) a += 2 * Math.PI;
      return a;
    };
    const ease = {
      inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
      out: (t) => 1 - (1 - t) * (1 - t),
    };

    const store = {
      get() { try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } },
      set() { try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch (e) { /* ignore */ } },
    };

    let L = null;          // current layout
    let letters = [];      // { ch, el, adv, asc, inkDx, half, target, tray }
    let els = {};
    let state = { cx: 0, a1: 0, a2: 0, w: 0, g: 24, carry: -1, beam: false, reveal: Infinity };
    let runId = 0;
    let narrowMode = null;
    let taskText = "STANDBY";

    /* ---------- layout ---------- */
    function makeLayout(narrow) {
      if (!narrow) {
        return {
          W: 1200, H: 700, font: 92,
          lines: [{ text: "Owen O’Donnell", b: 250 }],
          tag: [{ text: "Mechatronics & AI Systems Engineering · Western University", y: 320 }],
          tagSize: 26,
          ctaY: 350,                 // top of the HTML status + buttons, in SVG units
          fixture: { x: 200, b: 560 },
          railY: 650, railX0: 40, railX1: 1160,
          parkA1: -150,
        };
      }
      return {
        W: 720, H: 1000, font: 78,
        lines: [{ text: "Owen", b: 230 }, { text: "O’Donnell", b: 320 }],
        tag: [
          { text: "Mechatronics & AI Systems Engineering", y: 382 },
          { text: "Western University", y: 416 },
        ],
        tagSize: 24,
        ctaY: 446,
        fixture: { x: 150, b: 760 },
        railY: 940, railX0: 24, railX1: 696,
        parkA1: -160,              // parks low so the arm stays clear of the buttons
      };
    }

    const isNarrow = () => {
      const r = stage.getBoundingClientRect();
      return r.width / Math.max(1, r.height) < 1.05;
    };

    const ctx = document.createElement("canvas").getContext("2d");
    function measure(ch, size) {
      ctx.font = `700 ${size}px ${FONT}`;
      const m = ctx.measureText(ch);
      const abl = m.actualBoundingBoxLeft || 0;
      const abr = m.actualBoundingBoxRight || m.width;
      return {
        adv: m.width,
        asc: m.actualBoundingBoxAscent || size * 0.72,
        inkDx: (abr - abl) / 2 - m.width / 2, // ink centre relative to glyph centre
        half: Math.max(4, (abl + abr) / 2),
      };
    }

    function node(tag, attrs, parent) {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }

    function build(narrow) {
      narrowMode = narrow;
      L = makeLayout(narrow);
      const { W, H } = L;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.textContent = "";
      letters = [];

      // Name glyph targets
      let underline = null;
      L.lines.forEach((line) => {
        const chars = Array.from(line.text);
        const ms = chars.map((c) => measure(c, L.font));
        const total = ms.reduce((s, m) => s + m.adv, 0);
        const start = W / 2 - total / 2;
        let cum = 0;
        chars.forEach((ch, i) => {
          const m = ms[i];
          if (ch !== " ") letters.push({ ch, ...m, target: { x: start + cum + m.adv / 2, b: line.b } });
          cum += m.adv;
        });
        underline = { x0: start, x1: start + total, y: line.b + 28 };
      });

      // Arm geometry sized so the highest approach point is comfortably reachable
      L.shY = L.railY - 56;
      const minY = Math.min(...letters.map((lt) => lt.target.b - lt.asc - GRIP_DY - APPROACH));
      L.R = (L.shY - minY) / 0.9;
      L.L1 = L.R * 0.52;
      L.L2 = L.R * 0.48;

      // --- static scenery: fixture that holds the "O" ---
      const gTray = node("g", { class: "tray-group" }, svg);
      const F = L.fixture;
      node("rect", { class: "fixture", x: F.x - 64, y: F.b + 10, width: 128, height: 12, rx: 2 }, gTray);
      node("path", { class: "fixture", d: `M${F.x - 46} ${F.b + 10} L${F.x - 34} ${F.b - 2} L${F.x + 34} ${F.b - 2} L${F.x + 46} ${F.b + 10} Z` }, gTray);
      node("line", { class: "tray-tick", x1: F.x, y1: F.b + 26, x2: F.x, y2: F.b + 34 }, gTray);
      node("text", { class: "tray-label", x: F.x, y: F.b + 50, "text-anchor": "middle" }, gTray).textContent = "FIXTURE A · PART 01";

      const gRail = node("g", {}, svg);
      node("rect", { class: "arm-rail", x: L.railX0, y: L.railY, width: L.railX1 - L.railX0, height: 12, rx: 3 }, gRail);
      for (let x = L.railX0 + 20; x <= L.railX1 - 20; x += 40) {
        node("line", { class: "arm-tick", x1: x, y1: L.railY + 18, x2: x, y2: L.railY + 24 }, gRail);
      }
      node("rect", { class: "arm-rail", x: L.railX0 - 8, y: L.railY - 10, width: 8, height: 30, rx: 2 }, gRail);
      node("rect", { class: "arm-rail", x: L.railX1, y: L.railY - 10, width: 8, height: 30, rx: 2 }, gRail);
      node("text", { class: "rail-label", x: L.railX1, y: L.railY + 44, "text-anchor": "end" }, gRail).textContent = "AXIS 0 · LINEAR RAIL";

      // --- arm (drawn back to front) ---
      els.carriage = node("g", {}, svg);
      node("rect", { class: "arm-body", x: -60, y: L.railY - 26, width: 120, height: 26, rx: 4 }, els.carriage);
      node("circle", { class: "arm-bolt", cx: -46, cy: L.railY - 13, r: 3 }, els.carriage);
      node("circle", { class: "arm-bolt", cx: 46, cy: L.railY - 13, r: 3 }, els.carriage);
      node("path", { class: "arm-body", d: `M-40 ${L.railY - 26} L-26 ${L.shY} L26 ${L.shY} L40 ${L.railY - 26} Z` }, els.carriage);

      const link = (len, h) => {
        const g = node("g", {}, svg);
        node("rect", { class: "arm-link", x: -h / 2, y: -h / 2, width: len + h, height: h, rx: h / 2 }, g);
        node("line", { class: "arm-link-center", x1: 0, y1: 0, x2: len, y2: 0 }, g);
        node("line", { class: "axis-x", x1: 0, y1: 0, x2: 54, y2: 0 }, g);
        node("path", { class: "axis-tip-x", d: "M60 0 L52 -4 L52 4 Z" }, g);
        node("line", { class: "axis-y", x1: 0, y1: 0, x2: 0, y2: -40 }, g);
        node("path", { class: "axis-tip-y", d: "M0 -46 L-4 -38 L4 -38 Z" }, g);
        return g;
      };
      els.link1 = link(L.L1, 30);
      els.link2 = link(L.L2, 24);

      const joint = (r, core) => {
        const g = node("g", {}, svg);
        node("circle", { class: "arm-joint", r }, g);
        node("circle", { class: "arm-joint-core", r: core }, g);
        return g;
      };
      els.elbow = joint(17, 5);
      els.shoulder = joint(22, 6);

      // Letters: the first "O" is picked and placed; the rest are laid down behind the tool
      const defs = node("defs", {}, svg);
      const clip = node("clipPath", { id: "intro-reveal" }, defs);
      els.clipRect = node("rect", { x: 0, y: 0, width: W, height: H }, clip);
      const gLetters = node("g", {}, svg);
      const gReveal = node("g", { "clip-path": "url(#intro-reveal)" }, svg);
      letters.forEach((lt, i) => {
        lt.el = node("text", { class: "intro-letter", "text-anchor": "middle", "font-size": L.font, x: 0, y: 0 }, i === 0 ? gLetters : gReveal);
        lt.el.textContent = lt.ch;
        lt.left = lt.target.x - lt.adv / 2;
        lt.right = lt.target.x + lt.adv / 2;
      });
      letters[0].tray = { x: L.fixture.x, b: L.fixture.b };

      // Tool beam used while laying down the letters
      const lowest = Math.max(...L.lines.map((l) => l.b)) + 14;
      L.beamY2 = lowest;
      els.beamGlow = node("line", { class: "arm-beam-glow", x1: 0, y1: 0, x2: 0, y2: lowest }, svg);
      els.beam = node("line", { class: "arm-beam", x1: 0, y1: 0, x2: 0, y2: lowest }, svg);

      // Gripper (in front of letters so the fingers overlap what they hold)
      els.grip = node("g", {}, svg);
      els.gripBar = node("rect", { class: "arm-body", x: -30, y: 17, width: 60, height: 6, rx: 2 }, els.grip);
      node("rect", { class: "arm-body", x: -7, y: 6, width: 14, height: 10 }, els.grip);
      node("rect", { class: "arm-body", x: -26, y: 13, width: 52, height: 12, rx: 3 }, els.grip);
      els.fingerL = node("rect", { class: "arm-finger", x: -30, y: 22, width: 7, height: 46, rx: 2 }, els.grip);
      els.fingerR = node("rect", { class: "arm-finger", x: 23, y: 22, width: 7, height: 46, rx: 2 }, els.grip);
      node("circle", { class: "arm-joint", r: 11 }, els.grip);
      node("circle", { class: "arm-joint-core", r: 3.5 }, els.grip);

      els.rot = node("g", { class: "rot-group" }, svg);
      els.rotArc = node("path", { class: "rot-arc", d: "" }, els.rot);
      els.rotText = node("text", { class: "rot-label" }, els.rot);

      // Underline + tagline (revealed when done)
      const u = underline;
      node("line", { class: "intro-underline", x1: u.x0, y1: u.y, x2: u.x1, y2: u.y, pathLength: 1 }, svg);
      node("line", { class: "intro-underline-tick", x1: u.x0, y1: u.y - 7, x2: u.x0, y2: u.y + 7 }, svg);
      node("line", { class: "intro-underline-tick", x1: u.x1, y1: u.y - 7, x2: u.x1, y2: u.y + 7 }, svg);
      L.tag.forEach((t) => {
        node("text", { class: "intro-tagline", x: W / 2, y: t.y, "text-anchor": "middle", "font-size": L.tagSize }, svg).textContent = t.text;
      });

      // The HTML status + buttons are placed in CSS from these, using the SVG's own scale
      intro.style.setProperty("--vb-w", W);
      intro.style.setProperty("--vb-h", H);
      intro.style.setProperty("--cta-y", L.ctaY);
    }

    /* ---------- kinematics ---------- */
    function fk(s) {
      const S = { x: s.cx, y: L.shY };
      const E = { x: S.x + L.L1 * Math.cos(s.a1), y: S.y + L.L1 * Math.sin(s.a1) };
      const W = { x: E.x + L.L2 * Math.cos(s.a2), y: E.y + L.L2 * Math.sin(s.a2) };
      return { S, E, W };
    }

    function ikBoth(cx, P) {
      const { L1, L2 } = L;
      const dx = P.x - cx, dy = P.y - L.shY;
      const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
      const th = Math.atan2(dy, dx);
      const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      return [th - al, th + al].map((a1) => {
        const ex = cx + L1 * Math.cos(a1), ey = L.shY + L1 * Math.sin(a1);
        return { a1, a2: Math.atan2(P.y - ey, P.x - ex), ex, ey };
      });
    }
    const ikUp = (cx, P) => { const [a, b] = ikBoth(cx, P); return a.ey <= b.ey ? a : b; };
    const ikNear = (cx, P, ref) => {
      const [a, b] = ikBoth(cx, P);
      return Math.abs(angDiff(ref, a.a1)) <= Math.abs(angDiff(ref, b.a1)) ? a : b;
    };

    // Pick a carriage position that keeps the arm comfortably extended and in frame
    function chooseCx(Wa, Wg, cur) {
      const { R, W } = L;
      const lo = L.railX0 + 70, hi = L.railX1 - 70;
      let best = null, bestScore = Infinity;
      for (let cx = lo; cx <= hi; cx += 6) {
        const da = Math.hypot(Wa.x - cx, Wa.y - L.shY);
        const dg = Math.hypot(Wg.x - cx, Wg.y - L.shY);
        if (da > 0.96 * R || dg > 0.96 * R || da < 0.22 * R || dg < 0.22 * R) continue;
        const sa = ikUp(cx, Wa);
        const sg = ikNear(cx, Wg, sa.a1);
        let s = Math.abs(da - 0.72 * R) + 0.18 * Math.abs(cx - cur);
        [sa, sg].forEach((e) => {
          if (e.ex < 24) s += (24 - e.ex) * 12;
          if (e.ex > W - 24) s += (e.ex - W + 24) * 12;
          if (e.ey < 16) s += (16 - e.ey) * 12;
        });
        if (Math.abs(Wa.x - cx) < 40) s += 150;
        if (Math.abs(angDiff(sa.a1, sg.a1)) > 0.6) s += 500;
        if (s < bestScore) { bestScore = s; best = cx; }
      }
      return best != null ? best : clamp(Wa.x - 0.3 * R, lo, hi);
    }

    const parkPose = () => ({ cx: L.railX1 - 90, a1: L.parkA1 / DEG, a2: 0.12, g: 24 });

    function waypoints(lt, pos) {
      const g = { x: pos.x + lt.inkDx, y: pos.b - lt.asc - GRIP_DY };
      return { g, a: { x: g.x, y: g.y - APPROACH } };
    }

    /* ---------- rendering ---------- */
    const fmtAngle = (rad) => {
      const d = rad * DEG;
      return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(1).padStart(5, " ") + "°";
    };

    function setLetter(lt, pos) {
      lt.el.setAttribute("transform", `translate(${pos.x.toFixed(2)} ${pos.b.toFixed(2)})`);
    }

    function render() {
      const { S, E, W } = fk(state);
      els.carriage.setAttribute("transform", `translate(${S.x.toFixed(2)} 0)`);
      els.link1.setAttribute("transform", `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)}) rotate(${(state.a1 * DEG).toFixed(3)})`);
      els.link2.setAttribute("transform", `translate(${E.x.toFixed(2)} ${E.y.toFixed(2)}) rotate(${(state.a2 * DEG).toFixed(3)})`);
      els.elbow.setAttribute("transform", `translate(${E.x.toFixed(2)} ${E.y.toFixed(2)})`);
      els.shoulder.setAttribute("transform", `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)})`);
      const wDeg = state.w * DEG;
      els.grip.setAttribute("transform", `translate(${W.x.toFixed(2)} ${W.y.toFixed(2)}) rotate(${wDeg.toFixed(3)})`);
      els.fingerL.setAttribute("x", (-state.g - 7).toFixed(2));
      els.fingerR.setAttribute("x", state.g.toFixed(2));
      els.gripBar.setAttribute("x", (-state.g - 10).toFixed(2));
      els.gripBar.setAttribute("width", (2 * state.g + 20).toFixed(2));

      if (state.carry >= 0) {
        const lt = letters[state.carry];
        lt.el.setAttribute("transform",
          `translate(${W.x.toFixed(2)} ${W.y.toFixed(2)}) rotate(${wDeg.toFixed(3)}) translate(${(-lt.inkDx).toFixed(2)} ${(GRIP_DY + lt.asc).toFixed(2)})`);
      }

      // Wrist rotation dimension: arc from straight down to the current wrist angle
      if (Math.abs(state.w) > 0.002) {
        const r = 126, a0 = Math.PI / 2, a1 = a0 + state.w;   // clears the held letter
        const p0 = { x: W.x + r * Math.cos(a0), y: W.y + r * Math.sin(a0) };
        const p1 = { x: W.x + r * Math.cos(a1), y: W.y + r * Math.sin(a1) };
        els.rotArc.setAttribute("d", `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${r} ${r} 0 0 ${state.w > 0 ? 1 : 0} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`);
        const am = a0 + state.w / 2;
        els.rotText.setAttribute("x", (W.x + (r + 14) * Math.cos(am)).toFixed(1));
        els.rotText.setAttribute("y", (W.y + (r + 14) * Math.sin(am) + 14).toFixed(1));
        els.rotText.textContent = `θ3 ${fmtAngle(state.w).replace(/\s+/g, "")}`;
      }

      // Tool beam + reveal mask for the letters laid down behind it
      els.beam.classList.toggle("on", state.beam);
      els.beamGlow.classList.toggle("on", state.beam);
      if (state.beam) {
        [els.beam, els.beamGlow].forEach((b) => {
          b.setAttribute("x1", W.x.toFixed(2)); b.setAttribute("x2", W.x.toFixed(2));
          b.setAttribute("y1", (W.y + 68).toFixed(2));
        });
      }
      els.clipRect.setAttribute("width", Math.max(0, Math.min(L.W, state.reveal)).toFixed(2));

      hud.rail.textContent = (state.cx - L.railX0).toFixed(1).padStart(6, " ");
      hud.j1.textContent = fmtAngle(-state.a1);
      hud.j2.textContent = fmtAngle(-angDiff(state.a1, state.a2));
      hud.j3.textContent = fmtAngle(state.w);
      hud.tcp.textContent = `${W.x.toFixed(0).padStart(4, " ")}, ${(L.H - W.y).toFixed(0).padStart(4, " ")}`;
      hud.grip.textContent = state.carry >= 0 ? `HOLD “${letters[state.carry].ch}”` : state.beam ? "TOOL ON" : "OPEN";
      hud.task.textContent = taskText;
    }

    /* ---------- motion primitives ---------- */
    function tween(dur, fn, easing, id) {
      return new Promise((resolve) => {
        if (id !== runId) return resolve();
        const t0 = performance.now();
        const frame = (now) => {
          if (id !== runId) return resolve();
          const t = Math.min(1, (now - t0) / dur);
          fn(easing(t));
          render();
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    }

    function jointMove(to, dur, id) {
      const from = { ...state };
      const d2 = angDiff(from.a2, to.a2);
      return tween(dur, (k) => {
        state.cx = lerp(from.cx, to.cx, k);
        state.a1 = lerp(from.a1, to.a1, k);
        state.a2 = from.a2 + d2 * k;
        if (to.g != null) state.g = lerp(from.g, to.g, k);
      }, ease.inOut, id);
    }

    function linMove(P, dur, id) {
      const W0 = fk(state).W;
      return tween(dur, (k) => {
        const p = { x: lerp(W0.x, P.x, k), y: lerp(W0.y, P.y, k) };
        const s = ikNear(state.cx, p, state.a1);
        state.a1 = state.a1 + angDiff(state.a1, s.a1);
        state.a2 = s.a2;
      }, ease.sine, id);
    }

    // One continuous move: lift straight up (optional) -> joint-space transit -> straight descent.
    // A single ease spans all three, so the arm never stops at the approach points.
    function sweep(to, dur, id, lift) {
      const s0 = { ...state };
      const W0 = fk(s0).W;
      const U = lift ? { x: W0.x, y: W0.y - APPROACH } : W0;
      let a1u = s0.a1, a2u = s0.a2;
      if (lift) {
        const su = ikNear(s0.cx, U, s0.a1);
        a1u = s0.a1 + angDiff(s0.a1, su.a1);
        a2u = su.a2;
      }
      const sa = ikUp(to.cx, to.Pa);
      const a1a = normA1(sa.a1), a2a = sa.a2;
      const g0 = s0.g, g1 = to.g != null ? to.g : s0.g;
      const w0 = s0.w, w1 = to.w != null ? to.w : s0.w;

      // Straight segments get a little more time per pixel than the open transit
      const lenL = lift ? APPROACH * 1.6 : 0;
      const lenT = Math.hypot(to.Pa.x - U.x, to.Pa.y - U.y) * 0.75 + Math.abs(to.cx - s0.cx) * 0.25 + 40;
      const lenD = Math.hypot(to.Pg.x - to.Pa.x, to.Pg.y - to.Pa.y) * 1.6;
      const total = lenL + lenT + lenD;

      const cart = (cx, A, B, t) => {
        const s = ikNear(cx, { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t) }, state.a1);
        state.cx = cx;
        state.a1 = state.a1 + angDiff(state.a1, s.a1);
        state.a2 = s.a2;
      };
      return tween(dur, (k) => {
        const d = k * total;
        if (d < lenL) {
          cart(s0.cx, W0, U, d / lenL);
        } else if (d < lenL + lenT) {
          const t = (d - lenL) / lenT;
          state.cx = lerp(s0.cx, to.cx, t);
          state.a1 = lerp(a1u, a1a, t);
          state.a2 = a2u + angDiff(a2u, a2a) * t;
        } else {
          cart(to.cx, to.Pa, to.Pg, Math.min(1, (d - lenL - lenT) / lenD));
        }
        state.g = lerp(g0, g1, Math.min(1, k * 1.5));
        state.w = lerp(w0, w1, ease.inOut(Math.min(1, k * 1.25)));
      }, ease.inOut, id);
    }

    function gripTo(g, dur, id) {
      const from = state.g;
      return tween(dur, (k) => { state.g = lerp(from, g, k); }, ease.out, id);
    }

    const wait = (ms, id) => tween(ms, () => {}, (t) => t, id);

    function wristTo(w, dur, id) {
      const from = state.w;
      return tween(dur, (k) => { state.w = lerp(from, w, k); }, ease.inOut, id);
    }

    /* ---------- sequence ---------- */
    const railLo = () => L.railX0 + 70;
    const railHi = () => L.railX1 - 70;
    const TOOL_OFFSET = 150;   // carriage trails the tool by this much while laying down letters

    function resetScene() {
      letters.forEach((lt, i) => {
        lt.el.classList.toggle("hot", i > 0);
        if (i > 0) setLetter(lt, lt.target);
      });
      setLetter(letters[0], letters[0].tray);
      state = { ...parkPose(), w: 0, carry: -1, beam: false, reveal: -1 };
      els.rot.classList.remove("on");
      taskText = "STANDBY";
      render();
    }

    async function play() {
      const id = ++runId;
      intro.classList.remove("is-done");
      skipBtn.hidden = false;
      replayBtn.hidden = true;
      resetScene();
      store.set();

      // Timing budget ≈ 4.5 s: pick (0.9 s), wrist show-off (0.5 s), place (0.8 s), lay down the rest (1.7 s), park.
      const O = letters[0];
      const openG = Math.max(O.half + 14, 22);
      const closeG = O.half + 1;
      const pick = waypoints(O, O.tray);
      const place = waypoints(O, O.target);

      await wait(150, id);
      taskText = "PICK   PART 01 “O”";
      let cx = chooseCx(pick.a, pick.g, state.cx);
      await sweep({ cx, Pa: pick.a, Pg: pick.g, g: openG }, 620, id, false);
      await gripTo(closeG, 110, id);
      if (id !== runId) return;
      state.carry = 0;
      await linMove(pick.a, 230, id);

      taskText = "ROTATE J3  −90°";
      els.rot.classList.add("on");
      await wristTo(-Math.PI / 2, 400, id);
      await wait(90, id);

      taskText = "PLACE  PART 01";
      cx = chooseCx(place.a, place.g, state.cx);
      await sweep({ cx, Pa: place.a, Pg: place.g, w: 0 }, 700, id, false);
      if (id !== runId) return;
      els.rot.classList.remove("on");
      state.carry = -1;
      setLetter(O, O.target);
      await gripTo(openG, 90, id);

      // Retract along the rail; the rest of the name is laid down behind the tool
      const rest = letters.slice(1);
      const sx = Math.min(...rest.map((lt) => lt.left)) - 6;
      const ex = Math.max(...rest.map((lt) => lt.right)) + 8;
      const hoverY = Math.min(...letters.map((lt) => lt.target.b - lt.asc)) - 68 - 18;
      const cxAt = (x) => clamp(x + TOOL_OFFSET, railLo(), railHi());
      taskText = "LAY DOWN  02–" + String(letters.length).padStart(2, "0");
      const s0 = ikUp(cxAt(sx), { x: sx, y: hoverY });
      await jointMove({ cx: cxAt(sx), a1: normA1(s0.a1), a2: s0.a2, g: 5 }, 330, id);
      if (id !== runId) return;
      state.beam = true;
      await tween(1550, (k) => {
        const x = lerp(sx, ex, k);
        state.cx = cxAt(x);
        const s = ikNear(state.cx, { x, y: hoverY }, state.a1);
        state.a1 = state.a1 + angDiff(state.a1, s.a1);
        state.a2 = s.a2;
        state.reveal = x;
        rest.forEach((lt) => { if (x > lt.right + 36) lt.el.classList.remove("hot"); });
      }, ease.sine, id);
      if (id !== runId) return;
      state.beam = false;
      state.reveal = Infinity;
      rest.forEach((lt) => lt.el.classList.remove("hot"));
      taskText = "COMPLETE";
      intro.classList.add("is-done");   // reveal the hero now; the arm parks while it fades in
      await jointMove({ ...parkPose(), w: 0 }, 480, id);
      if (id !== runId) return;
      finish();
    }

    function finish() {
      runId++; // cancels any running sequence
      letters.forEach((lt) => { setLetter(lt, lt.target); lt.el.classList.remove("hot"); });
      state = { ...parkPose(), w: 0, carry: -1, beam: false, reveal: Infinity };
      els.rot.classList.remove("on");
      taskText = "COMPLETE";
      render();
      intro.classList.add("is-done");
      skipBtn.hidden = true;
      replayBtn.hidden = false;
    }

    skipBtn.addEventListener("click", () => {
      finish();
      replayBtn.focus({ preventScroll: true });
    });
    replayBtn.addEventListener("click", () => play());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !intro.classList.contains("is-done")) finish();
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const narrow = isNarrow();
        if (narrow !== narrowMode) {
          build(narrow);
          finish();
        }
      }, 150);
    });

    (async function start() {
      try {
        if (document.fonts && document.fonts.load) {
          await Promise.race([
            document.fonts.load(`700 80px Inter`),
            new Promise((r) => setTimeout(r, 1800)),
          ]);
        }
      } catch (e) { /* fall back to system font */ }

      build(isNarrow());
      const firstVisit = !store.get();
      if (firstVisit && !location.hash && !reduceMotion) play();
      else finish();
    })();
  })();
})();
