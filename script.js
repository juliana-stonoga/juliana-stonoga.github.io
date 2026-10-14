/* =========================================================
   Fundo interativo: rede de partículas (nós e conexões)
   - os nós se conectam quando estão próximos
   - o cursor cria conexões e afasta levemente os nós
   - um clique adiciona novos nós
   ========================================================= */
(function () {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const settings = {
    density: 14000,       // área (px²) por partícula
    maxParticles: 110,
    linkDistance: 140,
    mouseDistance: 220,
    glowRadius: 460,      // raio do brilho difuso em volta do cursor
    speed: 0.3
  };

  // Cores do fundo vêm do CSS (variáveis --particle-* e --pointer-*),
  // assim cada arquivo de estilo carrega a sua própria paleta.
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim().replace(/["']/g, "") || fallback;
  const theme = {
    colors: read("--particle-colors", "255,255,255").split(";").map((c) => c.trim()).filter(Boolean),
    dotAlpha: parseFloat(read("--particle-alpha", "0.95")),
    lineAlpha: parseFloat(read("--particle-line-alpha", "0.55")),
    pointer: read("--pointer-rgb", "255,255,255"),
    pointerLineAlpha: parseFloat(read("--pointer-line-alpha", "0.85")),
    glowAlpha: parseFloat(read("--pointer-glow-alpha", "0.4"))
  };

  const mouse = { x: null, y: null };
  let particles = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;

  function createParticle(x, y, burst) {
    const angle = Math.random() * Math.PI * 2;
    const speed = settings.speed * (burst ? 2.5 + Math.random() * 2 : 0.4 + Math.random());
    return {
      x: x !== undefined ? x : Math.random() * width,
      y: y !== undefined ? y : Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1 + Math.random() * 1.6,
      color: theme.colors[Math.floor(Math.random() * theme.colors.length)]
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.min(settings.maxParticles, Math.round((width * height) / settings.density));
    while (particles.length < target) particles.push(createParticle());
    if (particles.length > target) particles.length = target;
  }

  function step() {
    for (const p of particles) {
      // Repulsão suave do cursor
      if (mouse.x !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < settings.mouseDistance && dist > 0) {
          const force = (1 - dist / settings.mouseDistance) * 0.06;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // Atrito leve para voltar à velocidade de cruzeiro
      const v = Math.hypot(p.vx, p.vy);
      const max = settings.speed * 1.4;
      if (v > max) {
        p.vx *= 0.97;
        p.vy *= 0.97;
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) { p.vx *= -1; p.x = Math.max(0, Math.min(width, p.x)); }
      if (p.y < 0 || p.y > height) { p.vy *= -1; p.y = Math.max(0, Math.min(height, p.y)); }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Conexões entre partículas
    const link = settings.linkDistance;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) > link || Math.abs(dy) > link) continue;
        const dist = Math.hypot(dx, dy);
        if (dist < link) {
          ctx.strokeStyle = `rgba(${a.color},${(1 - dist / link) * theme.lineAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Conexões com o cursor
    if (mouse.x !== null) {
      for (const p of particles) {
        const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dist < settings.mouseDistance) {
          ctx.strokeStyle = `rgba(${theme.pointer},${(1 - dist / settings.mouseDistance) * theme.pointerLineAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      // Brilho difuso: raio grande e queda suave (curva gaussiana), sem borda visível
      const r = settings.glowRadius;
      const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        glow.addColorStop(t, `rgba(${theme.pointer},${theme.glowAlpha * Math.exp(-5 * t * t)})`);
      }
      glow.addColorStop(1, `rgba(${theme.pointer},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(mouse.x - r, mouse.y - r, r * 2, r * 2);
    }

    // Nós
    for (const p of particles) {
      ctx.fillStyle = `rgba(${p.color},${theme.dotAlpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    if (!running) return;
    step();
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) draw();
  });

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) mouse.x = mouse.y = null; });
  window.addEventListener("blur", () => { mouse.x = mouse.y = null; });

  window.addEventListener("click", (e) => {
    if (reduceMotion || e.target.closest("a, button")) return;
    for (let i = 0; i < 4; i++) particles.push(createParticle(e.clientX, e.clientY, true));
    // Mantém o total limitado, removendo os nós mais antigos
    const limit = settings.maxParticles + 40;
    if (particles.length > limit) particles.splice(0, particles.length - limit);
  });

  // Pausa a animação quando a aba não está visível
  document.addEventListener("visibilitychange", () => {
    if (reduceMotion) return;
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });

  resize();
  if (reduceMotion) {
    draw(); // quadro estático
  } else {
    requestAnimationFrame(loop);
  }
})();

/* =========================================================
   Texto digitado no hero
   ========================================================= */
(function () {
  const el = document.getElementById("typed");
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const phrases = [
    "desenvolvedora de software",
    "estudante de Engenharia de Software",
    "code review e versionamento",
    "pesquisadora em IA"
  ];
  let phrase = 0;
  let chars = phrases[0].length;
  let deleting = true;

  function tick() {
    const text = phrases[phrase];
    chars += deleting ? -1 : 1;
    el.textContent = text.slice(0, chars);

    let delay = deleting ? 35 : 70;
    if (!deleting && chars === text.length) {
      deleting = true;
      delay = 2200;
    } else if (deleting && chars === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      delay = 350;
    }
    setTimeout(tick, delay);
  }
  setTimeout(tick, 2600);
})();

/* =========================================================
   Revelação das seções e link ativo na navegação
   ========================================================= */
(function () {
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js");

  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        reveal.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));

  const links = document.querySelectorAll("nav ul a");
  const active = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach((s) => active.observe(s));
})();

/* =========================================================
   Carrossel de projetos
   - setas, bolinhas e contador
   - avanço automático (pausa com mouse/foco em cima)
   - setas do teclado e arrastar no celular
   ========================================================= */
(function () {
  const carousel = document.querySelector(".carousel");
  if (!carousel) return;

  const track = carousel.querySelector(".carousel-track");
  const slides = carousel.querySelectorAll(".slide");
  const dotsBox = carousel.querySelector(".carousel-dots");
  const current = carousel.querySelector(".current");
  const total = carousel.querySelector(".total");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  let index = 0;
  let timer = null;

  total.textContent = pad(slides.length);

  const dots = Array.from(slides, (slide, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "Ir para " + slide.querySelector("h3").textContent);
    dot.addEventListener("click", () => { go(i); restart(); });
    dotsBox.appendChild(dot);
    return dot;
  });

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, n) => {
      const hidden = n !== index;
      s.setAttribute("aria-hidden", hidden);
      // Evita que o Tab entre em links de slides escondidos
      s.querySelectorAll("a, button").forEach((el) => { el.tabIndex = hidden ? -1 : 0; });
    });
    dots.forEach((d, n) => {
      d.classList.toggle("active", n === index);
      d.setAttribute("aria-current", n === index);
    });
    current.textContent = pad(index + 1);
  }

  function start() {
    if (reduceMotion || timer) return;
    timer = setInterval(() => go(index + 1), 6000);
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  function restart() {
    stop();
    start();
  }

  carousel.querySelector(".prev").addEventListener("click", () => { go(index - 1); restart(); });
  carousel.querySelector(".next").addEventListener("click", () => { go(index + 1); restart(); });

  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", start);

  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { go(index - 1); }
    if (e.key === "ArrowRight") { go(index + 1); }
  });

  // Arrastar (toque)
  let startX = null;
  const windowEl = carousel.querySelector(".carousel-window");
  windowEl.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; stop(); }, { passive: true });
  windowEl.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
    startX = null;
    start();
  });

  go(0);
  start();
})();

/* =========================================================
   Cursor: bolinha luminosa que segue o mouse
   ========================================================= */
(function () {
  const dot = document.querySelector(".cursor-dot");
  if (!dot || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.documentElement.classList.add("has-cursor");

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    dot.classList.add("visible");
    dot.classList.toggle("hover", !!e.target.closest("a, button"));
  });
  // Esconde a bolinha quando o mouse sai da janela
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) dot.classList.remove("visible"); });
  window.addEventListener("blur", () => dot.classList.remove("visible"));
  window.addEventListener("pointerdown", () => dot.classList.add("down"));
  window.addEventListener("pointerup", () => dot.classList.remove("down"));
})();
