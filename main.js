/* ================================================================
   ExergyNet -- Site JS v2.1
================================================================ */

(function () {
  "use strict";

  /* ====================== FAVICON ====================== */
  function injectFavicon() {
    if (document.querySelector("link[rel~='icon']")) return; // already set
    var link = document.createElement("link");
    link.rel  = "icon";
    link.type = "image/x-icon";
    link.href = "https://exergynet.org/assets/favicon.ico";
    document.head.appendChild(link);
    var shortcut = document.createElement("link");
    shortcut.rel  = "shortcut icon";
    shortcut.type = "image/x-icon";
    shortcut.href = "https://exergynet.org/assets/favicon.ico";
    document.head.appendChild(shortcut);
  }
  injectFavicon();

  /* ====================== THEME ====================== */
  var THEME_KEY = "exg-theme";

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    syncThemeButtons(theme);
  }

  function syncThemeButtons(theme) {
    document.querySelectorAll(".theme-toggle").forEach(function(btn) {
      btn.textContent = theme === "light" ? "\u263E" : "\u2600";
      btn.title = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || getStoredTheme() || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  window.toggleTheme = toggleTheme;
  applyTheme(getStoredTheme() || "dark");

  /* ====================== INJECTION ====================== */
  function injectHeaderFooter() {
    Promise.all([
      fetch("header.html").then(function(r) { return r.ok ? r.text() : Promise.reject(); }),
      fetch("footer.html").then(function(r) { return r.ok ? r.text() : Promise.reject(); })
    ])
    .then(function(results) {
      var headerHTML = results[0], footerHTML = results[1];
      var hEl = document.getElementById("site-header");
      var fEl = document.getElementById("site-footer");
      if (hEl) hEl.innerHTML = headerHTML;
      if (fEl) fEl.innerHTML = footerHTML;
      initNav();
      var yearEl = document.getElementById("footer-year");
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    })
    .catch(function() {
      console.warn("Running on file:// -- using inline fallback");
      var hEl = document.getElementById("site-header");
      if (hEl) hEl.innerHTML = '<nav id="main-nav">' +
        '<a href="index.html" class="nav-logo"><span class="nav-logo-mark"></span>ExergyNet</a>' +
        '<ul class="nav-links" id="nav-links">' +
          '<li><a href="index.html">Home</a></li>' +
          '<li><a href="docs.html">Docs</a></li>' +
          '<li><a href="nodes.html">Node Ops</a></li>' +
          '<li><a href="whitepaper.html">Whitepaper</a></li>' +
          '<li><a href="protocol.html">Protocol</a></li>' +
          '<li><a href="mcp.html">MCP</a></li>' +
          '<li><a href="agents.html">Agents</a></li>' +
          '<li><a href="proof.html">Proof</a></li>' +
          '<li><a href="security.html">Security</a></li>' +
          '<li><a href="roadmap.html">Roadmap</a></li>' +
          '<li><a href="explorer.html">Explorer</a></li>' +
        '</ul>' +
        '<div class="nav-actions">' +
          '<div class="nav-social">' +
            '<a href="https://x.com/ExergyNet" target="_blank" class="nav-social-link">&#x1D54F;</a>' +
            '<a href="https://discord.com/channels/1500548202384986203/1500548202959732970" target="_blank" class="nav-social-link">&#x2666;</a>' +
          '</div>' +
          '<button class="theme-toggle" id="theme-toggle">\u2600</button>' +
          '<button class="hamburger" id="hamburger">&#9776;</button>' +
        '</div>' +
      '</nav>';

      var fElem = document.getElementById("site-footer");
      if (fElem) fElem.innerHTML = '<footer id="main-footer"><div class="footer-inner">' +
        '<div class="footer-brand"><div class="footer-logo"><span class="footer-pulse"></span>ExergyNet</div>' +
        '<p class="footer-tagline">Thermodynamic ZK-Compute<br>for Autonomous Agents</p></div>' +
        '<div class="footer-meta">' +
        '<div class="footer-status"><span class="footer-status-dot"></span>LNES-03 &middot; Solana &middot; Live</div>' +
        '<div class="footer-copy">&copy; ' + new Date().getFullYear() + ' ExergyNet.</div>' +
        '<div class="footer-program">Program: <code>7BCPpUMB&hellip;4CcCL</code></div>' +
        '</div></div></footer>';

      initNav();
    });
  }

  function initNav() {
    var current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach(function(link) {
      if (link.getAttribute("href") && link.getAttribute("href").endsWith(current)) {
        link.classList.add("active");
      }
    });

    document.querySelectorAll(".theme-toggle").forEach(function(btn) {
      btn.addEventListener("click", toggleTheme);
    });
    syncThemeButtons(document.documentElement.getAttribute("data-theme") || "dark");

    var hamburger = document.getElementById("hamburger");
    var navLinks  = document.getElementById("nav-links");
    if (hamburger && navLinks) {
      hamburger.addEventListener("click", function() {
        var isOpen = navLinks.classList.toggle("open");
        hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      document.addEventListener("click", function(e) {
        if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
          navLinks.classList.remove("open");
          hamburger.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  /* ====================== CANVAS — Earth from Space ====================== */
  /*
   * City light clusters mapped to real geography.
   * Data pulses arc between them like satellite signals.
   * Stars twinkle in the background.
   */
  function initCanvas() {
    var canvas = document.getElementById("circuit-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var W, H, T = 0;

    /* ── City clusters (normalised 0–1 coords) ── */
    var CLUSTERS = [
      { cx: 0.18, cy: 0.32, spread: 0.055, count: 22, col: "amber" }, // N America East
      { cx: 0.08, cy: 0.30, spread: 0.040, count: 14, col: "amber" }, // N America West
      { cx: 0.47, cy: 0.24, spread: 0.060, count: 28, col: "blue"  }, // Europe
      { cx: 0.75, cy: 0.30, spread: 0.055, count: 26, col: "blue"  }, // East Asia
      { cx: 0.70, cy: 0.42, spread: 0.045, count: 18, col: "green" }, // SE Asia
      { cx: 0.56, cy: 0.36, spread: 0.035, count: 12, col: "amber" }, // Middle East
      { cx: 0.44, cy: 0.47, spread: 0.040, count: 10, col: "green" }, // Africa West
      { cx: 0.24, cy: 0.56, spread: 0.045, count: 14, col: "amber" }, // South America
      { cx: 0.79, cy: 0.60, spread: 0.035, count: 10, col: "blue"  }, // Australia
      { cx: 0.65, cy: 0.18, spread: 0.080, count:  8, col: "blue"  }  // Russia / Siberia
    ];

    /* Arc routes between cluster indices */
    var ARC_PAIRS = [
      [0, 2], [0, 3], [2, 3], [2, 4], [1, 3], [3, 8],
      [0, 7], [2, 5], [5, 4], [4, 3], [6, 7], [2, 6],
      [0, 6], [4, 8], [3, 9], [2, 9]
    ];

    var STARS  = [];
    var CITIES = [];
    var ARCS   = [];

    /* ── Build stars ── */
    function makeStars() {
      STARS = [];
      for (var i = 0; i < 260; i++) {
        STARS.push({
          x:     Math.random() * W,
          y:     Math.random() * H,
          r:     Math.random() * 0.9 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: 0.008 + Math.random() * 0.018
        });
      }
    }

    /* ── Build city lights ── */
    function makeCities() {
      CITIES = [];
      CLUSTERS.forEach(function(cl) {
        for (var i = 0; i < cl.count; i++) {
          var angle = Math.random() * Math.PI * 2;
          var dist  = Math.pow(Math.random(), 0.5) * cl.spread;
          CITIES.push({
            bx:          cl.cx + Math.cos(angle) * dist,
            by:          cl.cy + Math.sin(angle) * dist,
            driftAngle:  Math.random() * Math.PI * 2,
            driftR:      0.0008 + Math.random() * 0.001,
            driftSpeed:  0.0003 + Math.random() * 0.0005,
            size:        0.8 + Math.random() * 1.6,
            bright:      0.4 + Math.random() * 0.6,
            col:         cl.col,
            phase:       Math.random() * Math.PI * 2,
            twinkleSpd:  0.015 + Math.random() * 0.04
          });
        }
      });
    }

    /* ── Build arcs ── */
    function makeArcs() {
      ARCS = [];
      ARC_PAIRS.forEach(function(pair, idx) {
        ARCS.push({
          ai:       pair[0],
          bi:       pair[1],
          progress: Math.random(),
          speed:    0.0006 + Math.random() * 0.001,
          active:   Math.random() > 0.3,
          col:      idx % 3 === 0 ? "green" : idx % 3 === 1 ? "blue" : "amber",
          lw:       0.5 + Math.random() * 0.8,
          opacity:  0.10 + Math.random() * 0.16
        });
      });
    }

    /* ── Helpers ── */
    function colRgba(col, a) {
      if (col === "green") return "rgba(0,232,135,"  + a + ")";
      if (col === "blue")  return "rgba(78,158,255," + a + ")";
      if (col === "amber") return "rgba(255,184,48," + a + ")";
      return "rgba(255,255,255," + a + ")";
    }

    function cityXY(c) {
      var t = T * c.driftSpeed;
      return {
        x: (c.bx + Math.cos(c.driftAngle + t) * c.driftR) * W,
        y: (c.by + Math.sin(c.driftAngle + t) * c.driftR) * H
      };
    }

    function clusterCenter(idx) {
      return { x: CLUSTERS[idx].cx * W, y: CLUSTERS[idx].cy * H };
    }

    /* Quadratic bezier arc — control point lifted toward top (simulates globe curve) */
    function arcCtrl(ax, ay, bx, by) {
      var mx = (ax + bx) / 2, my = (ay + by) / 2;
      var dist = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      return { cx: mx, cy: my - dist * 0.42 };
    }

    function drawArcLine(ax, ay, bx, by, col, alpha, lw) {
      var c = arcCtrl(ax, ay, bx, by);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(c.cx, c.cy, bx, by);
      ctx.strokeStyle = colRgba(col, alpha);
      ctx.lineWidth   = lw;
      ctx.stroke();
    }

    function bezierPt(ax, ay, bx, by, t) {
      var c  = arcCtrl(ax, ay, bx, by);
      var ix = (1-t)*(1-t)*ax + 2*(1-t)*t*c.cx + t*t*bx;
      var iy = (1-t)*(1-t)*ay + 2*(1-t)*t*c.cy + t*t*by;
      return { x: ix, y: iy };
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    /* ── Main draw loop ── */
    function draw() {
      T++;
      ctx.clearRect(0, 0, W, H);

      var isDark = document.documentElement.getAttribute("data-theme") !== "light";

      /* 1. Stars */
      if (isDark) {
        for (var s = 0; s < STARS.length; s++) {
          var st  = STARS[s];
          var tw  = 0.3 + 0.7 * Math.abs(Math.sin(st.phase + T * st.speed));
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255," + (tw * 0.55).toFixed(3) + ")";
          ctx.fill();
        }
      }

      /* 2. Faint permanent arc lanes */
      for (var a = 0; a < ARCS.length; a++) {
        var arc = ARCS[a];
        var A   = clusterCenter(arc.ai);
        var B   = clusterCenter(arc.bi);
        drawArcLine(A.x, A.y, B.x, B.y, arc.col,
          isDark ? arc.opacity * 0.4 : arc.opacity * 0.12,
          arc.lw * 0.5);
      }

      /* 3. Travelling data pulses */
      for (var p = 0; p < ARCS.length; p++) {
        var arc = ARCS[p];
        if (!arc.active) continue;

        arc.progress += arc.speed;
        if (arc.progress > 1) {
          arc.progress = 0;
          arc.active   = Math.random() > 0.08;
        }

        var A  = clusterCenter(arc.ai);
        var B  = clusterCenter(arc.bi);
        var pt = bezierPt(A.x, A.y, B.x, B.y, arc.progress);

        /* Glow halo */
        var gr = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 8);
        gr.addColorStop(0, colRgba(arc.col, isDark ? 0.85 : 0.55));
        gr.addColorStop(1, colRgba(arc.col, 0));
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();

        /* Core dot */
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = colRgba(arc.col, 1);
        ctx.fill();
      }

      /* 4. Periodically reactivate dormant arcs */
      if (T % 150 === 0) {
        ARCS.forEach(function(arc) {
          if (!arc.active && Math.random() > 0.45) arc.active = true;
        });
      }

      /* 5. City lights */
      for (var ci = 0; ci < CITIES.length; ci++) {
        var c   = CITIES[ci];
        var pos = cityXY(c);
        var tw  = c.bright * (0.55 + 0.45 * Math.sin(c.phase + T * c.twinkleSpd));
        var al  = isDark ? tw : tw * 0.30;

        /* Soft glow halo */
        var gr = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, c.size * 3.5);
        gr.addColorStop(0, colRgba(c.col, al * 0.85));
        gr.addColorStop(1, colRgba(c.col, 0));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, c.size * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();

        /* Hard pixel core */
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, c.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = colRgba(c.col, Math.min(1, al * 1.5));
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function() {
      resize();
      makeStars();
      makeCities();
      makeArcs();
    });

    resize();
    makeStars();
    makeCities();
    makeArcs();
    draw();
  }

  /* ====================== BOOT ====================== */
  document.addEventListener("DOMContentLoaded", function () {
    injectHeaderFooter();
    initCanvas();
  });

})();
