/* ================================================================
   ExergyNet -- Site JS v2.0
================================================================ */

(function () {
  "use strict";

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

  /* ====================== CANVAS ====================== */
  function initCanvas() {
    var canvas = document.getElementById("circuit-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var W, H, nodes = [], edges = [];
    var NODE_COUNT = 38;
    var EDGE_DIST  = 180;
    var PULSE_SPEED = 0.012;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function makeNodes() {
      nodes = [];
      for (var i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x:  Math.random() * W,
          y:  Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r:  Math.random() * 1.5 + 0.5
        });
      }
    }

    function buildEdges() {
      edges = [];
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x;
          var dy = nodes[i].y - nodes[j].y;
          var dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < EDGE_DIST) {
            edges.push({ a: i, b: j, pulse: Math.random(), active: Math.random() > 0.65 });
          }
        }
      }
    }

    var isDark = true;

    function getColors() {
      isDark = document.documentElement.getAttribute("data-theme") !== "light";
      return {
        node:   isDark ? "rgba(0,232,135,0.55)"  : "rgba(0,122,66,0.45)",
        nodeB:  isDark ? "rgba(78,158,255,0.45)" : "rgba(21,88,176,0.40)",
        edge:   isDark ? "rgba(0,232,135,0.06)"  : "rgba(0,122,66,0.06)",
        pulse:  isDark ? "rgba(0,232,135,0.5)"   : "rgba(0,122,66,0.5)",
        pulseB: isDark ? "rgba(78,158,255,0.5)"  : "rgba(21,88,176,0.5)"
      };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var C = getColors();

      for (var n = 0; n < nodes.length; n++) {
        var nd = nodes[n];
        nd.x += nd.vx; nd.y += nd.vy;
        if (nd.x < 0 || nd.x > W) nd.vx *= -1;
        if (nd.y < 0 || nd.y > H) nd.vy *= -1;
      }

      buildEdges();

      for (var e = 0; e < edges.length; e++) {
        var ed = edges[e];
        var na = nodes[ed.a], nb = nodes[ed.b];
        var dx = nb.x - na.x, dy = nb.y - na.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        var alpha = (1 - dist / EDGE_DIST) * 0.55;

        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = ed.active ? C.edge.replace("0.06", String(alpha * 0.18)) : C.edge;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        if (ed.active) {
          ed.pulse = (ed.pulse + PULSE_SPEED) % 1;
          var px = na.x + dx * ed.pulse;
          var py = na.y + dy * ed.pulse;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = (e % 3 === 0) ? C.pulseB : C.pulse;
          ctx.fill();
        }
      }

      for (var ni = 0; ni < nodes.length; ni++) {
        var nd2 = nodes[ni];
        ctx.beginPath();
        ctx.arc(nd2.x, nd2.y, nd2.r, 0, Math.PI * 2);
        ctx.fillStyle = (ni % 4 === 0) ? C.nodeB : C.node;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function() { resize(); makeNodes(); });
    resize();
    makeNodes();
    draw();
  }

  /* ====================== BOOT ====================== */
  document.addEventListener("DOMContentLoaded", function () {
    injectHeaderFooter();
    initCanvas();
  });

})();
