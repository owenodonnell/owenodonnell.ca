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
    ? $$("a", navLinks).filter((a) => /^#.+/.test(a.getAttribute("href") || ""))
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
      ".section-title, .about-text, .fact-card, .exp-card, .project-card, .lead-card, .skill-group, .contact-links, .project-head, .project-hero-media, .project-detail-grid"
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

  // Image slots: show the placeholder until a real photo exists in images/
  $$(".project-media img").forEach((img) => {
    const media = img.parentElement;
    const markMissing = () => media.classList.add("is-placeholder");
    if (img.complete && img.naturalWidth === 0) markMissing();
    img.addEventListener("error", markMissing);
    img.addEventListener("load", () => media.classList.remove("is-placeholder"));
  });

  /* =========================================================
     Projects: horizontal scroller with arrow buttons
     ========================================================= */
  (function initProjectScroller() {
    const track = $("#project-track");
    if (!track) return;
    const btns = $$(".scroll-btn");
    const step = () => {
      const card = $(".project-card", track);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      btns.forEach((b) => {
        const dir = Number(b.dataset.dir);
        b.disabled = dir < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= max;
      });
    };
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        track.scrollBy({ left: Number(b.dataset.dir) * step(), behavior: reduceMotion ? "auto" : "smooth" });
      })
    );
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { track.scrollBy({ left: step(), behavior: "smooth" }); e.preventDefault(); }
      if (e.key === "ArrowLeft") { track.scrollBy({ left: -step(), behavior: "smooth" }); e.preventDefault(); }
    });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* =========================================================
     Experience: sticky timeline that fills as you scroll
     ========================================================= */
  (function initExperienceTimeline() {
    const rail = $(".exp-rail");
    if (!rail) return;
    const nodes = $$(".exp-node", rail);
    const cards = $$(".exp-card");
    const n = cards.length;
    if (!n) return;
    let ticking = false;

    const update = () => {
      ticking = false;
      const focus = window.innerHeight * 0.45;
      const tops = cards.map((c) => c.getBoundingClientRect().top);
      let i = -1;
      for (let k = 0; k < n; k++) if (tops[k] <= focus) i = k;

      let progress;
      if (i < 0) progress = 0;
      else if (i >= n - 1) progress = 1;
      else progress = (i + (focus - tops[i]) / (tops[i + 1] - tops[i])) / (n - 1);

      rail.style.setProperty("--fill", Math.max(0, Math.min(1, progress)).toFixed(4));
      const active = Math.max(0, i);
      nodes.forEach((node, k) => {
        node.classList.toggle("reached", i >= 0 && k <= active);
        node.classList.toggle("active", k === active);
      });
      cards.forEach((c, k) => c.classList.toggle("active", i >= 0 && k === active));
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
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
      rail: $("#hud-rail"), j1: $("#hud-j1"), j2: $("#hud-j2"),
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
    let state = { cx: 0, a1: 0, a2: 0, g: 24, carry: -1 };
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
          trays: [{ b: 560, n: 13, x0: 96, x1: 1104 }],
          railY: 650, railX0: 40, railX1: 1160,
        };
      }
      return {
        W: 720, H: 900, font: 78,
        lines: [{ text: "Owen", b: 260 }, { text: "O’Donnell", b: 350 }],
        tag: [
          { text: "Mechatronics & AI Systems Engineering", y: 412 },
          { text: "Western University", y: 446 },
        ],
        tagSize: 24,
        trays: [{ b: 600, n: 7, x0: 70, x1: 650 }, { b: 690, n: 6, x0: 118, x1: 602 }],
        railY: 830, railX0: 24, railX1: 696,
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

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function assignTray() {
      const slots = [];
      L.trays.forEach((t) => {
        for (let k = 0; k < t.n; k++) slots.push({ x: t.x0 + ((t.x1 - t.x0) * k) / (t.n - 1), b: t.b });
      });
      const order = shuffle(slots.map((_, i) => i));
      letters.forEach((lt, i) => { lt.tray = slots[order[i]]; });
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

      // --- static scenery ---
      const gTray = node("g", { class: "tray-group" }, svg);
      L.trays.forEach((t, idx) => {
        const y = t.b + 16;
        node("line", { class: "tray-line", x1: t.x0 - 48, y1: y, x2: t.x1 + 48, y2: y }, gTray);
        for (let k = 0; k < t.n; k++) {
          const x = t.x0 + ((t.x1 - t.x0) * k) / (t.n - 1);
          node("line", { class: "tray-tick", x1: x, y1: y, x2: x, y2: y + 6 }, gTray);
        }
        if (idx === L.trays.length - 1) {
          node("text", { class: "tray-label", x: t.x0 - 48, y: y + 24 }, gTray).textContent = "INPUT TRAY";
        }
      });

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

      // Letters
      const gLetters = node("g", {}, svg);
      letters.forEach((lt) => {
        lt.el = node("text", { class: "intro-letter", "text-anchor": "middle", "font-size": L.font }, gLetters);
        lt.el.textContent = lt.ch;
      });

      // Gripper (in front of letters so the fingers overlap what they hold)
      els.grip = node("g", {}, svg);
      els.gripBar = node("rect", { class: "arm-body", x: -30, y: 17, width: 60, height: 6, rx: 2 }, els.grip);
      node("rect", { class: "arm-body", x: -7, y: 6, width: 14, height: 10 }, els.grip);
      node("rect", { class: "arm-body", x: -26, y: 13, width: 52, height: 12, rx: 3 }, els.grip);
      els.fingerL = node("rect", { class: "arm-finger", x: -30, y: 22, width: 7, height: 46, rx: 2 }, els.grip);
      els.fingerR = node("rect", { class: "arm-finger", x: 23, y: 22, width: 7, height: 46, rx: 2 }, els.grip);
      node("circle", { class: "arm-joint", r: 11 }, els.grip);
      node("circle", { class: "arm-joint-core", r: 3.5 }, els.grip);

      // Underline + tagline (revealed when done)
      const u = underline;
      node("line", { class: "intro-underline", x1: u.x0, y1: u.y, x2: u.x1, y2: u.y, pathLength: 1 }, svg);
      node("line", { class: "intro-underline-tick", x1: u.x0, y1: u.y - 7, x2: u.x0, y2: u.y + 7 }, svg);
      node("line", { class: "intro-underline-tick", x1: u.x1, y1: u.y - 7, x2: u.x1, y2: u.y + 7 }, svg);
      L.tag.forEach((t) => {
        node("text", { class: "intro-tagline", x: W / 2, y: t.y, "text-anchor": "middle", "font-size": L.tagSize }, svg).textContent = t.text;
      });

      assignTray();
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

    const parkPose = () => ({ cx: L.railX1 - 90, a1: -150 / DEG, a2: 0.12, g: 24 });

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
      lt.el.setAttribute("x", pos.x.toFixed(2));
      lt.el.setAttribute("y", pos.b.toFixed(2));
    }

    function render() {
      const { S, E, W } = fk(state);
      els.carriage.setAttribute("transform", `translate(${S.x.toFixed(2)} 0)`);
      els.link1.setAttribute("transform", `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)}) rotate(${(state.a1 * DEG).toFixed(3)})`);
      els.link2.setAttribute("transform", `translate(${E.x.toFixed(2)} ${E.y.toFixed(2)}) rotate(${(state.a2 * DEG).toFixed(3)})`);
      els.elbow.setAttribute("transform", `translate(${E.x.toFixed(2)} ${E.y.toFixed(2)})`);
      els.shoulder.setAttribute("transform", `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)})`);
      els.grip.setAttribute("transform", `translate(${W.x.toFixed(2)} ${W.y.toFixed(2)})`);
      els.fingerL.setAttribute("x", (-state.g - 7).toFixed(2));
      els.fingerR.setAttribute("x", state.g.toFixed(2));
      els.gripBar.setAttribute("x", (-state.g - 10).toFixed(2));
      els.gripBar.setAttribute("width", (2 * state.g + 20).toFixed(2));

      if (state.carry >= 0) {
        const lt = letters[state.carry];
        setLetter(lt, { x: W.x - lt.inkDx, b: W.y + GRIP_DY + lt.asc });
      }

      hud.rail.textContent = (state.cx - L.railX0).toFixed(1).padStart(6, " ");
      hud.j1.textContent = fmtAngle(-state.a1);
      hud.j2.textContent = fmtAngle(-angDiff(state.a1, state.a2));
      hud.tcp.textContent = `${W.x.toFixed(0).padStart(4, " ")}, ${(L.H - W.y).toFixed(0).padStart(4, " ")}`;
      hud.grip.textContent = state.carry >= 0 ? `HOLD “${letters[state.carry].ch}”` : "OPEN";
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

    function gripTo(g, dur, id) {
      const from = state.g;
      return tween(dur, (k) => { state.g = lerp(from, g, k); }, ease.out, id);
    }

    const wait = (ms, id) => tween(ms, () => {}, (t) => t, id);

    /* ---------- sequence ---------- */
    function resetToTray() {
      letters.forEach((lt) => setLetter(lt, lt.tray));
      state = { ...parkPose(), carry: -1 };
      taskText = "STANDBY";
      render();
    }

    async function play() {
      const id = ++runId;
      intro.classList.remove("is-done");
      skipBtn.hidden = false;
      replayBtn.hidden = true;
      resetToTray();
      store.set();

      await wait(500, id);
      for (let i = 0; i < letters.length; i++) {
        if (id !== runId) return;
        const lt = letters[i];
        const f = Math.max(0.34, 1 - i * 0.085); // starts deliberate, then speeds up
        const openG = Math.max(lt.half + 14, 22);
        const closeG = lt.half + 1;
        const pick = waypoints(lt, lt.tray);
        const place = waypoints(lt, lt.target);
        taskText = `${String(i + 1).padStart(2, "0")}/${letters.length}  “${lt.ch}”`;

        let cx = chooseCx(pick.a, pick.g, state.cx);
        let s = ikUp(cx, pick.a);
        await jointMove({ cx, a1: normA1(s.a1), a2: s.a2, g: openG }, 400 * f, id);
        await linMove(pick.g, 130 * f, id);
        await gripTo(closeG, 70 * f, id);
        if (id !== runId) return;
        state.carry = i;
        await linMove(pick.a, 110 * f, id);

        cx = chooseCx(place.a, place.g, state.cx);
        s = ikUp(cx, place.a);
        await jointMove({ cx, a1: normA1(s.a1), a2: s.a2 }, 420 * f, id);
        await linMove(place.g, 130 * f, id);
        if (id !== runId) return;
        state.carry = -1;
        setLetter(lt, lt.target);
        await gripTo(openG, 60 * f, id);
        await linMove(place.a, 90 * f, id);
      }
      if (id !== runId) return;
      taskText = "COMPLETE";
      await jointMove(parkPose(), 900, id);
      if (id !== runId) return;
      finish();
    }

    function finish() {
      runId++; // cancels any running sequence
      letters.forEach((lt) => setLetter(lt, lt.target));
      state = { ...parkPose(), carry: -1 };
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
    replayBtn.addEventListener("click", () => {
      assignTray();
      play();
    });
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
