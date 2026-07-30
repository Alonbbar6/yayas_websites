/* =========================================================
   Walks with Yaya — interactions & cinematic motion
   ========================================================= */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Preloader ---------- */
  window.addEventListener("load", () => {
    const pre = $("[data-preloader]");
    if (pre) setTimeout(() => pre.classList.add("is-done"), 500);
    startHero();
  });

  /* ---------- Year ---------- */
  const y = $("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Custom cursor ---------- */
  const cursor = $("[data-cursor]");
  const dot = $("[data-cursor-dot]");
  if (cursor && dot && window.matchMedia("(hover:hover)").matches) {
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener("mousemove", (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = `translate(${tx}px,${ty}px) translate(-50%,-50%)`;
    });
    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    $$("[data-cursor-hover], a, button").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
    });
  }

  /* ---------- Scroll progress + sticky nav ---------- */
  const progress = $("[data-progress]");
  const nav = $("[data-nav]");
  const onScroll = () => {
    const st = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? (st / h) * 100 : 0) + "%";
    if (nav) nav.classList.toggle("is-stuck", st > 40);
    parallax();
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const toggle = $("[data-nav-toggle]");
  const links = $("[data-nav-links]");
  if (toggle && links) {
    const close = () => { toggle.classList.remove("is-open"); links.classList.remove("is-open"); };
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("is-open");
      links.classList.toggle("is-open");
    });
    $$("a", links).forEach((a) => a.addEventListener("click", close));
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          const sibs = [...e.target.parentElement.querySelectorAll("[data-reveal]")];
          const idx = sibs.indexOf(e.target);
          e.target.style.transitionDelay = Math.min(idx, 6) * 70 + "ms";
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Hero line reveal ---------- */
  function startHero() {
    if (reduceMotion) return;
    $$("[data-hero-line]").forEach((line, i) => {
      line.animate(
        [{ transform: "translateY(110%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
        { duration: 900, delay: 250 + i * 150, easing: "cubic-bezier(.22,.61,.36,1)", fill: "forwards" }
      );
    });
  }

  /* ---------- Parallax ---------- */
  const parallaxEls = $$("[data-parallax]");
  function parallax() {
    if (reduceMotion) return;
    const y = window.scrollY;
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.2;
      el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
    });
  }

  /* ---------- Animated counters ---------- */
  const counters = $$("[data-count]");
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const dur = 1600;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(eased * target);
      el.textContent = val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString() + suffix;
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  } else counters.forEach(runCounter);

  /* ---------- 3D tilt ---------- */
  if (!reduceMotion && window.matchMedia("(hover:hover)").matches) {
    $$("[data-tilt]").forEach((el) => {
      const max = 9;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Paw-trail generator (hero) ---------- */
  const trail = $("[data-paw-trail]");
  if (trail && !reduceMotion) {
    const paws = 7;
    for (let i = 0; i < paws; i++) {
      const p = document.createElement("span");
      p.textContent = "🐾";
      p.style.cssText =
        `position:absolute;bottom:${i % 2 ? 0 : 14}px;right:${i * 13}%;font-size:1.1rem;opacity:0;` +
        `transform:rotate(${i % 2 ? 12 : -12}deg);animation:pawFade 4s ease-in-out ${i * 0.35}s infinite;`;
      trail.appendChild(p);
    }
    if (!$("#pawKeyframes")) {
      const st = document.createElement("style");
      st.id = "pawKeyframes";
      st.textContent = "@keyframes pawFade{0%,100%{opacity:0}30%,60%{opacity:.55}}";
      document.head.appendChild(st);
    }
  }

  /* ---------- Testimonials slider ---------- */
  const track = $("[data-quotes]");
  const dotsWrap = $("[data-quotes-dots]");
  if (track && dotsWrap) {
    const slides = $$(".quote", track);
    let idx = 0, timer;
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.setAttribute("aria-label", "Review " + (i + 1));
      if (i === 0) b.classList.add("is-active");
      b.addEventListener("click", () => { go(i); restart(); });
      dotsWrap.appendChild(b);
    });
    const dots = $$("button", dotsWrap);
    const go = (i) => {
      idx = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle("is-active", n === idx));
    };
    const next = () => go(idx + 1);
    const restart = () => { clearInterval(timer); timer = setInterval(next, 5500); };
    restart();
    const vp = $(".quotes__viewport");
    vp.addEventListener("mouseenter", () => clearInterval(timer));
    vp.addEventListener("mouseleave", restart);
  }

  /* ---------- FAQ: single-open accordion ---------- */
  const faqItems = $$(".faq__item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) faqItems.forEach((o) => { if (o !== item) o.open = false; });
    });
  });

  /* ---------- Booking form ---------- */
  const form = $("[data-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const success = $("[data-form-success]");
      const required = $$("[required]", form);
      let ok = true;
      required.forEach((f) => {
        const valid = f.checkValidity() && f.value.trim() !== "";
        f.style.borderColor = valid ? "" : "#ff7a59";
        if (!valid) ok = false;
      });
      if (!ok) return;
      if (success) {
        success.hidden = false;
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      form.querySelector('button[type="submit"]').textContent = "Sent! 🐾";
      setTimeout(() => form.reset(), 400);
    });
  }
})();
