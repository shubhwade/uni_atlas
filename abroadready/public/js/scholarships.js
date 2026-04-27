(() => {
  const { fetchAPI, skeleton, formatINR, showToast } = window.AbroadReady;
  const grid = document.getElementById("grid");

  function card(s) {
    const val = s.total_value_inr || s.amount_inr || 0;
    return `
      <div class="card pad">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="h3">${s.name}</div>
            <div class="caption muted">${s.provider || ""}</div>
          </div>
          <span class="badge success">${formatINR(val)}</span>
        </div>
        <div class="spacer"></div>
        <div class="caption muted">Deadline: ${s.deadline || (s.deadline_month ? `${s.deadline_month}/${s.deadline_day}` : "varies")}</div>
        <div class="spacer"></div>
        <div class="row wrap">
          <a class="btn sm" href="${s.application_url || "#"}" target="_blank" rel="noreferrer">Apply</a>
          <button class="btn sm" data-save="${s.id}" type="button">Save</button>
        </div>
      </div>
    `;
  }

  async function load() {
    const c = document.getElementById("qCountry").value.trim();
    const d = document.getElementById("qDegree").value.trim();
    const f = document.getElementById("qField").value.trim();
    grid.innerHTML = skeleton(6).join("");
    const data = await fetchAPI(`/api/scholarships?country=${encodeURIComponent(c)}&degree=${encodeURIComponent(d)}&field=${encodeURIComponent(f)}&limit=30`);
    grid.innerHTML = (data.scholarships || []).map(card).join("") || `<div class="caption muted">No results.</div>`;
  }

  document.getElementById("apply").addEventListener("click", () => load().catch((e) => showToast(e.message, "error")));
  document.getElementById("matchBtn").addEventListener("click", async () => {
    grid.innerHTML = skeleton(6).join("");
    try {
      const data = await fetchAPI("/api/scholarships/matched");
      grid.innerHTML = (data.matched || []).map(card).join("") || `<div class="caption muted">No matches.</div>`;
    } catch (e) {
      showToast(e.message || "Match failed", "error");
    }
  });

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-save]");
    if (!btn) return;
    try {
      const r = await fetchAPI(`/api/scholarships/${btn.dataset.save}/save`, { method: "POST" });
      showToast(r.saved ? "Saved" : "Unsaved", "success");
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message, "error")));
})();

