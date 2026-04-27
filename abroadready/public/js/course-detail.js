(() => {
  const { fetchAPI, showToast, formatINR, showModal } = window.AbroadReady;

  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function showMissingCourse() {
    document.getElementById("title").textContent = "Course not selected";
    document.getElementById("sub").textContent = "Open a course from the course explorer or a university detail page.";
    document.getElementById("details").innerHTML = `<div class="h2">No course selected</div><div class="spacer"></div><a class="btn" href="/universities">Browse universities</a>`;
    document.getElementById("crowd").innerHTML = `<tr><td colspan="5" class="caption muted">No course selected.</td></tr>`;
  }

  async function load() {
    const id = Number(qp("id"));
    if (!id) {
      showMissingCourse();
      return;
    }

    const [c, crowd, resumes] = await Promise.all([
      fetchAPI(`/api/courses/${id}`),
      fetchAPI(`/api/courses/${id}/crowdsourced`).catch(() => ({ dataPoints: [] })),
      fetchAPI("/api/resumes").catch(() => ({ resumes: [] })),
    ]);

    const course = c.course;
    document.getElementById("title").textContent = course.name;
    document.getElementById("sub").textContent = `${course.university_name} - ${course.country_name} - ${course.degree || ""}`;

    document.getElementById("details").innerHTML = `
      <div class="h2">Overview</div>
      <div class="spacer"></div>
      <div class="row wrap">
        ${course.stem_designated ? `<span class="badge success">STEM</span>` : ""}
        ${course.gre_required ? `<span class="badge warning">GRE required</span>` : `<span class="badge">GRE optional</span>`}
        ${course.coa_total_inr ? `<span class="badge info">COA ${formatINR(course.coa_total_inr)}</span>` : `<span class="badge">COA unavailable</span>`}
      </div>
      <div class="spacer"></div>
      <div class="caption muted">Duration: ${course.duration_months || "Unavailable"} months</div>
      <div class="caption muted">Placement: ${course.placement_rate_percent ? `${Math.round(course.placement_rate_percent)}%` : "Unavailable"}</div>
    `;

    const tbody = document.getElementById("crowd");
    const rows = (crowd.dataPoints || []).slice(0, 20);
    tbody.innerHTML =
      rows
        .map(
          (p) => `<tr>
            <td>${p.gpa_forty ?? "-"}</td>
            <td>${p.gre_total ?? "-"}</td>
            <td>${p.work_exp_years ?? "-"}</td>
            <td>${p.result || "-"}</td>
            <td>${p.result_date || "-"}</td>
          </tr>`,
        )
        .join("") || `<tr><td colspan="5" class="caption muted">No crowdsourced data points available yet. Add results from past applicants to improve calibration.</td></tr>`;

    document.getElementById("saveBtn").addEventListener("click", async () => {
      try {
        const r = await fetchAPI(`/api/courses/${id}/save`, { method: "POST" });
        showToast(r.saved ? "Saved" : "Unsaved", "success");
      } catch (e) {
        showToast(e.message || "Save failed", "error");
      }
    });

    document.getElementById("predictBtn").addEventListener("click", async () => {
      try {
        const primary = (resumes.resumes || []).find((r) => r.is_primary) || (resumes.resumes || [])[0];
        const payload = { courseId: id, resumeId: primary?.id || null };
        const r = await fetchAPI("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const p = r.prediction;
        document.getElementById("predOut").innerHTML = `
          <div class="card pad predCard">
            <div class="row" style="justify-content:space-between">
              <div>
                <div class="h3">${Math.round(p.finalProbability * 100)}% - ${p.ai.admitCategory}</div>
                <div class="caption muted" style="margin-top:6px">Provider: ${p.ai.provider || "AI"}</div>
              </div>
              <span class="badge info">${p.ai.confidenceLevel}</span>
            </div>
            <div class="caption muted">${p.ai.confidenceReason || ""}</div>
            <div class="spacer"></div>
            <button class="btn sm" id="viewNarr" type="button">View narrative</button>
          </div>
        `;
        document.getElementById("viewNarr").addEventListener("click", () => {
          showModal("Prediction narrative", `<div style="white-space:pre-wrap">${p.ai.narrative || ""}</div>`);
        });
        showToast("Prediction complete", "success");
      } catch (e) {
        showToast(e.message || "Prediction failed", "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message || "Load failed", "error")));
})();
