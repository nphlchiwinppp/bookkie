(() => {
  'use strict';

  const CONFIG = {
    enableGSAP: true,
    enableParticles: true,
    enableTypewriter: true,
    enableSvgMorph: true,

    // UX: allow user to toggle motion regardless of OS setting.
    allowUserMotionToggle: true,
  };

  const state = {
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    userReducedMotion: false,
    audioPlaying: false,
  };

  /* -------------------- Utilities -------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function prefersReducedMotion() {
    return state.reducedMotion || state.userReducedMotion;
  }

  function setPressed(btn, pressed) {
    btn?.setAttribute('aria-pressed', String(Boolean(pressed)));
  }

  /* -------------------- Reveal (IntersectionObserver fallback) -------------------- */
  function setupRevealsIO() {
    const items = $$('.reveal');

    // If IO is missing, just show everything.
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-inview'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.2 });

    items.forEach(el => io.observe(el));
  }

  /* -------------------- GSAP ScrollTrigger (preferred) -------------------- */
  function setupGSAP() {
    if (!CONFIG.enableGSAP) return;
    if (!window.gsap || !window.ScrollTrigger) return;
    if (prefersReducedMotion()) return;

    // Recommended: register plugin explicitly
    gsap.registerPlugin(ScrollTrigger);

    // Reveal animations (more expressive than CSS-only)
    $$('.reveal').forEach((el) => {
      const type = el.dataset.reveal || 'fade-up';
      const delay = parseFloat(el.dataset.delay || '0');

      const from = {
        opacity: 0,
        y: type === 'zoom-in' ? 18 : 26,
        scale: type === 'zoom-in' ? 0.96 : 0.99,
        duration: 0.9,
        delay,
        ease: 'power3.out',
      };

      gsap.fromTo(el, from, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        }
      });
    });

    // Parallax
    $$('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0');
      const dist = clamp(speed * 140, 8, 90);

      gsap.to(el, {
        y: -dist,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    });
  }

  /* -------------------- Typewriter -------------------- */
  function typewriter(el, text, options = {}) {
    const {
      speed = 22,
      startDelay = 350,
      cursor = '▍',
    } = options;

    let i = 0;
    el.textContent = '';
    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'type-cursor';
    cursorSpan.textContent = cursor;
    el.appendChild(cursorSpan);

    const tick = () => {
      if (prefersReducedMotion()) {
        el.textContent = text;
        return;
      }

      i += 1;
      el.textContent = text.slice(0, i);
      el.appendChild(cursorSpan);

      if (i < text.length) {
        setTimeout(tick, speed);
      } else {
        cursorSpan.remove();
      }
    };

    setTimeout(tick, startDelay);
  }

  function setupTypewriters() {
    if (!CONFIG.enableTypewriter) return;

    const els = $$('[data-typewriter]');
    if (!els.length) return;

    const ioSupported = 'IntersectionObserver' in window;
    const run = (el) => {
      const source = el.dataset.source;
      const text = source ? ($(source)?.textContent || '') : (el.textContent || '');
      typewriter(el, text.trim());
    };

    if (!ioSupported) {
      els.forEach(run);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    els.forEach(el => io.observe(el));
  }

  /* -------------------- SVG Morph (Anime.js) -------------------- */
  function setupSvgMorph() {
    if (!CONFIG.enableSvgMorph) return;
    if (prefersReducedMotion()) return;
    if (!window.anime) return;

    // Anime.js v4 UMD: access methods from global object
    const { animate, svg, utils } = window.anime;
    if (!animate || !svg) return;

    const bowA = $('#bowA');
    const bowB = $('#bowB');
    if (!bowA || !bowB) return;

    // Safety: hide target path; use it only as shape source
    bowB.style.opacity = '0';

    const loopMorph = () => {
      animate(bowA, {
        d: svg.morphTo(bowB, 0.33),
        duration: 900,
        ease: 'inOutCirc',
        direction: 'alternate',
        loop: 2,
        onComplete: () => {
          // Go back to original (morphTo expects target; so swap by setting points back)
          // We can just set d back after loop.
          bowA.setAttribute('d', bowA.getAttribute('d')); // keep as-is
          setTimeout(loopMorph, utils.random(1400, 2600));
        }
      });
    };

    setTimeout(loopMorph, 900);
  }

  /* -------------------- Particles (Canvas sparkles) -------------------- */
  function setupParticles() {
    if (!CONFIG.enableParticles) return;
    if (prefersReducedMotion()) return;

    const canvas = $('#sparkles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });

    let w = 0, h = 0, dpr = 1;
    const sparkles = [];

    const resize = () => {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (x, y, count = 2) => {
      for (let i = 0; i < count; i++) {
        sparkles.push({
          x: x + (Math.random() * 30 - 15),
          y: y + (Math.random() * 30 - 15),
          vx: (Math.random() * 0.2 - 0.1),
          vy: (Math.random() * -0.35 - 0.05),
          r: Math.random() * 1.6 + 0.6,
          a: Math.random() * 0.35 + 0.2,
          life: Math.random() * 120 + 80,
        });
      }
    };

    const tick = () => {
      if (prefersReducedMotion()) {
        ctx.clearRect(0, 0, w, h);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const p = sparkles[i];
        p.x += p.vx * 16;
        p.y += p.vy * 16;
        p.life -= 1;
        p.a *= 0.995;

        // draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(181, 183, 140, ${p.a})`;
        ctx.fill();

        if (p.life <= 0 || p.a < 0.02) sparkles.splice(i, 1);
      }

      // Ambient spawn around hero area (upper half)
      if (Math.random() < 0.12) {
        spawn(w * (0.25 + Math.random() * 0.5), h * (0.18 + Math.random() * 0.28), 1);
      }

      requestAnimationFrame(tick);
    };

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(tick);
  }

  /* -------------------- Audio (user-gesture) -------------------- */
  function setupAudioUI() {
    const audio = $('#bgMusic');
    const btn = $('#audioToggle');
    if (!audio || !btn) return;

    const updateUI = () => {
      btn.querySelector('.ui-btn__icon').textContent = state.audioPlaying ? '🔊' : '🔈';
      btn.querySelector('.ui-btn__text').textContent = state.audioPlaying ? 'Pause' : 'Music';
      btn.setAttribute('aria-label', state.audioPlaying ? 'หยุดเพลงพื้นหลัง' : 'เปิดเพลงพื้นหลัง');
      setPressed(btn, state.audioPlaying);
    };

    const safePlay = async () => {
      try {
        await audio.play(); // returns Promise; may reject if autoplay blocked
        state.audioPlaying = true;
      } catch (err) {
        state.audioPlaying = false;
        console.warn('Audio play blocked by browser:', err);
        alert('เบราว์เซอร์บล็อกการเล่นอัตโนมัติ\nโปรดลองกดปุ่ม Music อีกครั้งหลังจากแตะหน้าจอ');
      } finally {
        updateUI();
      }
    };

    btn.addEventListener('click', async () => {
      if (state.audioPlaying) {
        audio.pause();
        state.audioPlaying = false;
        updateUI();
        return;
      }
      await safePlay();
    });

    updateUI();
  }

  /* -------------------- Motion toggle -------------------- */
  function setupMotionToggle() {
    if (!CONFIG.allowUserMotionToggle) return;

    const btn = $('#motionToggle');
    if (!btn) return;

    const updateUI = () => {
      setPressed(btn, prefersReducedMotion());
      btn.querySelector('.ui-btn__text').textContent = prefersReducedMotion() ? 'Reduced' : 'Motion';
      btn.setAttribute('aria-label', prefersReducedMotion() ? 'เปิดแอนิเมชัน' : 'ลดแอนิเมชัน');
    };

    btn.addEventListener('click', () => {
      state.userReducedMotion = !state.userReducedMotion;
      updateUI();

      // Quick page refresh approach: simplest way to stop running animations consistently.
      // If you want to avoid reload, you need to manually kill GSAP timelines, stop particles, etc.
      window.location.reload();
    });

    updateUI();
  }

  /* -------------------- Init -------------------- */
  window.addEventListener('DOMContentLoaded', () => {
    setupRevealsIO();     // always as baseline
    setupGSAP();          // enhance if available
    setupTypewriters();
    setupSvgMorph();
    setupParticles();
    setupAudioUI();
    setupMotionToggle();
  });

})();
