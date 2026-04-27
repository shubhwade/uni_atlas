(() => {
  const { fetchAPI, showToast, formatINR } = window.AbroadReady;

  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function courseCard(c) {
    return `
      <a class="courseRow" href="/course-detail?id=${encodeURIComponent(c.id)}">
        <div class="h3">${c.name}</div>
        <div class="caption muted">${c.degree || ""} - ${c.duration_months || ""} months</div>
        <div class="row wrap" style="margin-top:8px">
          <span class="badge info">${c.coa_total_inr ? formatINR(c.coa_total_inr) : "COA unavailable"}</span>
          ${c.stem_designated ? `<span class="badge success">STEM</span>` : ""}
          ${c.gre_required ? `<span class="badge warning">GRE</span>` : `<span class="badge">GRE optional</span>`}
        </div>
      </a>
    `;
  }

  async function load() {
    const slug = qp("slug");
    if (!slug) {
      document.getElementById("title").textContent = "University not selected";
      document.getElementById("sub").textContent = "Open a university from the explorer.";
      document.getElementById("overview").innerHTML = `<div class="h2">No university selected</div><div class="spacer"></div><a class="btn" href="/universities">Browse universities</a>`;
      return;
    }
    const data = await fetchAPI(`/api/universities/${encodeURIComponent(slug)}`);
    const u = data.university;

    document.getElementById("title").textContent = u.name;
    document.getElementById("sub").textContent = `${u.city || ""} - ${u.country_name || ""} - ${u.website || ""}`;
    document.getElementById("overview").innerHTML = `
      <div class="h2">Overview</div>
      <div class="spacer"></div>
      <div class="row wrap">
        ${u.qs_ranking_world ? `<span class="badge info">QS #${u.qs_ranking_world}</span>` : `<span class="badge">QS unavailable</span>`}
        ${u.university_type ? `<span class="badge">${u.university_type}</span>` : ""}
        ${u.campus_type ? `<span class="badge">${u.campus_type}</span>` : ""}
      </div>
      <div class="spacer"></div>
      <div class="caption muted">Research (OpenAlex): ${u.open_alex_id ? "linked" : "not linked yet"}</div>
      <div class="caption muted">Placement rate: ${u.overall_placement_rate ? `${Math.round(u.overall_placement_rate)}%` : "Unavailable"}</div>
    `;

    document.getElementById("courses").innerHTML =
      (data.courses || []).map(courseCard).join("") || `<div class="caption muted">No courses found.</div>`;

    document.getElementById("saveBtn").addEventListener("click", async () => {
      try {
        const r = await fetchAPI(`/api/universities/${encodeURIComponent(slug)}/save`, { method: "POST" });
        showToast(r.saved ? "Saved" : "Unsaved", "success");
      } catch (e) {
        showToast(e.message || "Save failed", "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message, "error")));
})();
