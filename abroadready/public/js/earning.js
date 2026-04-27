(() => {
  const { fetchAPI, showToast, skeleton } = window.AbroadReady;
  const grid = document.getElementById("grid");

  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  async function load(code) {
    grid.innerHTML = skeleton(6).join("");
    const data = await fetchAPI(`/api/countries/${encodeURIComponent(code)}/earning`);
    const rows = data.earning || [];
    grid.innerHTML = rows.length
      ? rows
          .map(
            (r) => `
            <div class="card pad er">
              <div class="h3">${r.title}</div>
              <div class="caption muted">${r.category}</div>
              <div class="caption muted">${r.platforms || ""}</div>
            </div>`,
          )
          .join("")
      : `<div class="caption muted">No seeded earning resources yet.</div>`;
  }

  document.getElementById("load").addEventListener("click", () => {
    const code = document.getElementById("code").value.trim().toLowerCase();
    if (!code) return showToast("Enter a code", "info");
    load(code).catch((e) => showToast(e.message, "error"));
  });

  document.addEventListener("DOMContentLoaded", () => {
    const code = (qp("code") || "").toLowerCase();
    if (code) {
      document.getElementById("code").value = code;
      load(code).catch((e) => showToast(e.message, "error"));
    }
  });
})();

