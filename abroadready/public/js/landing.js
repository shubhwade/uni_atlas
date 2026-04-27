(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const burger = document.querySelector(".nav__toggle");
  const links = document.querySelector("[data-nav-links]");
  if (burger && links) {
    const setOpen = (open) => {
      links.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    };

    burger.addEventListener("click", () => setOpen(!links.classList.contains("is-open")));

    links.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  const revealEls = Array.from(document.querySelectorAll(".reveal"));
  if (revealEls.length) {
    // Show all elements immediately without animation
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // Chart.js hero radar demo (safe no-op if Chart.js missing)
  const canvas = document.getElementById("heroRadar");
  if (canvas && window.Chart) {
    try {
      const ctx = canvas.getContext("2d");
      const accent = (alpha) => `rgba(124, 58, 237, ${alpha})`;
      const accent2 = (alpha) => `rgba(59, 130, 246, ${alpha})`;

      // eslint-disable-next-line no-new
      new window.Chart(ctx, {
        type: "radar",
        data: {
          labels: ["Academics", "Tests", "Work", "Research", "Projects", "Finance"],
          datasets: [
            {
              label: "Score",
              data: [76, 62, 71, 44, 78, 58],
              borderColor: accent2(0.85),
              backgroundColor: accent(0.18),
              pointBackgroundColor: accent2(0.85),
              pointRadius: 2.5,
              borderWidth: 1.8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(10,10,10,.92)",
              borderColor: "rgba(255,255,255,.10)",
              borderWidth: 1,
              titleColor: "rgba(245,247,251,.92)",
              bodyColor: "rgba(245,247,251,.78)",
              padding: 10,
            },
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false },
              angleLines: { color: "rgba(255,255,255,.08)" },
              grid: { color: "rgba(255,255,255,.08)" },
              pointLabels: { color: "rgba(245,247,251,.74)", font: { size: 12 } },
            },
          },
        },
      });
    } catch (error) {
      console.warn("Chart.js error:", error);
      // Hide the canvas if Chart.js fails
      canvas.style.display = "none";
    }
  }
})();

