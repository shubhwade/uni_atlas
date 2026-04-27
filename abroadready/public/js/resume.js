(() => {
  const { fetchAPI, showToast, showModal, skeleton } = window.AbroadReady;

  const list = document.getElementById("list");
  const status = document.getElementById("status");

  function scoreBars(r) {
    const o = Math.round(r.ai_score_overall || 0);
    return `<span class="badge info">Overall ${o}</span>`;
  }

  function card(r) {
    return `
      <div class="card pad resumeCard">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="h3">${r.file_name || "Resume"}</div>
            <div class="caption muted">${r.uploaded_at || ""} - ${(r.analysis_status || "").toUpperCase()}</div>
          </div>
          <div class="row wrap">
            ${r.is_primary ? `<span class="badge success">Primary</span>` : `<button class="btn sm" data-primary="${r.id}">Set primary</button>`}
            <button class="btn sm" data-view="${r.id}">View</button>
            <button class="btn sm" data-reanalyze="${r.id}">Re-analyze</button>
            <button class="btn sm danger" data-delete="${r.id}">Delete</button>
          </div>
        </div>
        <div class="row wrap">
          ${scoreBars(r)}
          ${r.ai_feedback_summary ? `<span class="caption muted">${r.ai_feedback_summary}</span>` : `<span class="caption muted">No analysis yet.</span>`}
        </div>
      </div>
    `;
  }

  async function refresh() {
    list.innerHTML = skeleton(3).join("");
    const data = await fetchAPI("/api/resumes");
    const rows = data.resumes || [];
    list.innerHTML = rows.length ? rows.map(card).join("") : `<div class="caption muted">No resumes yet.</div>`;
  }

  async function poll(id) {
    for (let i = 0; i < 40; i += 1) {
      const data = await fetchAPI(`/api/resumes/${id}`);
      const s = data.resume.analysis_status;
      if (s === "done" || s === "failed") return data;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  }

  document.getElementById("upload")?.addEventListener("click", async () => {
    const file = document.getElementById("file")?.files?.[0];
    if (!file) return showToast("Choose a PDF first", "info");
    status.textContent = "Uploading...";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/resumes/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      status.textContent = "Uploaded. Analysis started. Refreshing...";
      await refresh();
      const done = await poll(data.resumeId);
      if (done) {
        await refresh();
        showToast("Resume analysis updated", "success");
      }
    } catch (e) {
      status.textContent = "";
      showToast(e.message || "Upload failed", "error");
    }
  });

  document.getElementById("refresh")?.addEventListener("click", () => refresh().catch((e) => showToast(e.message, "error")));

  list?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    try {
      if (btn.dataset.view) {
        const data = await fetchAPI(`/api/resumes/${btn.dataset.view}`);
        if (!data.ok) {
          showToast("Failed to load resume analysis", "error");
          return;
        }
        const r = data.resume || {};
        const ai = data.ai || {};
        
        if (!ai || Object.keys(ai).length === 0) {
          showToast("No analysis data available yet. Please wait or re-analyze.", "info");
          return;
        }

        const parsed = data.resume.parsed_data ? JSON.parse(data.resume.parsed_data) : {};
        const ex = ai.extractedData || {};
        const score = r.ai_score_overall ? `${Math.round(r.ai_score_overall)}/100` : "—";
        
        const strengths = (ai.strengths || []).map((s) => `
          <div style="margin: 8px 0; padding: 8px; border-left: 3px solid #f8cf2f;">
            <strong>${s.point}</strong> <span style="font-size:11px; color:#666;">${s.impact}</span>
            <br/><small>${s.detail}</small>
          </div>
        `).join("");

        const weaknesses = (ai.weaknesses || []).map((w) => `
          <div style="margin: 8px 0; padding: 8px; border-left: 3px solid #ff6b6b;">
            <strong>${w.point}</strong> <span style="font-size:11px; color:#666;">${w.impact}</span>
            <br/><small>${w.detail}</small>
            ${w.fix ? `<br/><span style="color:#2ecc71;">💡 ${w.fix}</span>` : ""}
          </div>
        `).join("");

        const missing = (ai.missingForTopSchools || []).map((m) => `
          <div style="margin: 8px 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">
            <strong>${m.item}</strong> <span style="font-size:11px; color: ${m.urgency === 'critical' ? '#ff6b6b' : m.urgency === 'important' ? '#f39c12' : '#27ae60'};">${m.urgency}</span>
          </div>
        `).join("");

        const projects = (ex.topProjects || []).map(p => `
          <div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <strong>${p.title || "Project"}</strong>
            <p style="margin: 4px 0; font-size: 13px;">${p.description || ""}</p>
            ${p.impact ? `<small style="color: #666;">Impact: ${p.impact}</small>` : ""}
          </div>
        `).join("");

        const research = (ex.researchExperience || []).map(re => `
          <div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <strong>${re.title || "Research"}</strong> <em>(${re.role || "Role"})</em>
            <p style="margin: 4px 0; font-size: 13px;">${re.summary || ""}</p>
          </div>
        `).join("");

        const skills = (ex.skills || []).map(s => `<span style="display:inline-block; margin:3px; padding:4px 8px; background:#f0f0f0; border-radius:3px; font-size:12px;">${s}</span>`).join("");

        showModal("Detailed Resume Analysis", `
          <div style="max-width: 900px; line-height: 1.6;">
            <h3 style="color: #f8cf2f; margin-bottom: 10px;">Overall Score: ${score}</h3>
            <p style="background: #fffbea; padding: 12px; border-radius: 4px; border-left: 4px solid #f8cf2f;"><strong>Summary:</strong> ${r.ai_feedback_summary || "No summary available"}</p>
            
            ${strengths ? `<h4 style="margin-top: 16px; color: #27ae60;">✓ Strengths</h4><div>${strengths}</div>` : ""}
            ${weaknesses ? `<h4 style="margin-top: 16px; color: #e74c3c;">⚠ Areas for Improvement</h4><div>${weaknesses}</div>` : ""}
            ${skills ? `<h4 style="margin-top: 16px;">Skills Detected</h4><div>${skills || "No skills"}</div>` : ""}
            ${projects ? `<h4 style="margin-top: 16px;">Top Projects</h4><div>${projects}</div>` : ""}
            ${research ? `<h4 style="margin-top: 16px;">Research Experience</h4><div>${research}</div>` : ""}
            ${missing ? `<h4 style="margin-top: 16px;">For Top Schools</h4><div>${missing}</div>` : ""}
          </div>
        `);
      }
      if (btn.dataset.reanalyze) {
        await fetchAPI(`/api/resumes/${btn.dataset.reanalyze}/reanalyze`, { method: "POST" });
        showToast("Re-analysis started", "info");
        const done = await poll(btn.dataset.reanalyze);
        if (done) showToast("Re-analysis complete", "success");
        await refresh();
      }
      if (btn.dataset.primary) {
        await fetchAPI(`/api/resumes/${btn.dataset.primary}/primary`, { method: "PUT" });
        showToast("Primary updated", "success");
        await refresh();
      }
      if (btn.dataset.delete) {
        await fetchAPI(`/api/resumes/${btn.dataset.delete}`, { method: "DELETE" });
        showToast("Deleted", "success");
        await refresh();
      }
    } catch (err) {
      showToast(err.message || "Action failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => refresh().catch((e) => showToast(e.message, "error")));
})();
