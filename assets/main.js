// ExergyNet shared JS

(function () {
  function getPreferredTheme() {
    const saved = localStorage.getItem("exergynet-theme");

    if (saved === "dark" || saved === "light") {
      return saved;
    }

    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("exergynet-theme", theme);
    updateToggleIcon(theme);
  }

  window.toggleTheme = function toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") || getPreferredTheme();

    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  window.updateToggleIcon = function updateToggleIcon(theme) {
    const buttons = document.querySelectorAll("#theme-toggle, .theme-toggle");

    buttons.forEach((btn) => {
      btn.textContent = theme === "dark" ? "○" : "●";
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      btn.setAttribute("title", theme === "dark" ? "Light mode" : "Dark mode");
    });
  };

  function initTheme() {
    applyTheme(getPreferredTheme());
  }

  function initNav() {
    const hamburger = document.getElementById("hamburger");
    const navLinks = document.getElementById("nav-links");

    if (hamburger && navLinks) {
      hamburger.addEventListener("click", () => {
        navLinks.classList.toggle("open");
      });
    }

    const links = document.querySelectorAll(".nav-links a");
    const current = window.location.pathname.split("/").pop() || "index.html";

    links.forEach((link) => {
      const href = (link.getAttribute("href") || "").split("/").pop();

      if (href === current || (current === "" && href === "index.html")) {
        link.classList.add("active");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
  });
})();
