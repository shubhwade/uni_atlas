(() => {
  const { fetchAPI, showToast, skeleton } = window.AbroadReady;
  const statsEl = document.getElementById("stats");
  const out = document.getElementById("syncOut");

  async function loadStats() {
    statsEl.innerHTML = skeleton(4).join("");
    try {
      const data = await fetchAPI("/api/admin/stats");
      const c = data.counts || {};
      statsEl.innerHTML = Object.entries(c)
        .map(([k, v]) => `<div class="card pad stat"><div class="caption muted">${k}</div><div class="h2">${v}</div></div>`)
        .join("");
    } catch (e) {
      statsEl.innerHTML = `<div class="card pad"><div class="h3">Access denied</div><div class="caption muted">${e.message}</div></div>`;
    }
  }

  document.getElementById("syncUni").addEventListener("click", async () => {
    out.textContent = "Running…";
    try {
      const r = await fetchAPI("/api/admin/sync/universities", { method: "POST" });
      out.textContent = `Synced: ${r.synced || 0}`;
      showToast("Sync triggered", "success");
      await loadStats();
    } catch (e) {
      out.textContent = e.message || "Failed";
      showToast(e.message || "Failed", "error");
    }
  });

  document.getElementById("syncForex").addEventListener("click", async () => {
    out.textContent = "Running…";
    try {
      const r = await fetchAPI("/api/admin/sync/forex", { method: "POST" });
      out.textContent = `Forex updated (${r.source || "ok"})`;
      showToast("Forex sync triggered", "success");
    } catch (e) {
      out.textContent = e.message || "Failed";
      showToast(e.message || "Failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => loadStats().catch(() => null));
})();

