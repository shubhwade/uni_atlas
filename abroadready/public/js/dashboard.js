(() => {
  const { fetchAPI, skeleton, formatINR, showToast } = window.AbroadReady;

  function card(title, subtitle, rightHTML = "") {
    return `
      <div class="card pad">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="h3">${title}</div>
            <div class="caption muted">${subtitle || ""}</div>
          </div>
          ${rightHTML}
        </div>
      </div>
    `;
  }

  function resumeScoreBadge(score) {
    if (!score && score !== 0) return `<span class="badge">Not scored</span>`;
    const n = Math.round(score);
    const cls = n >= 75 ? "success" : n >= 50 ? "warning" : "danger";
    return `<span class="badge ${cls}">${n}/100</span>`;
  }

  async function load() {
    const actionItemsEl = document.getElementById("actionItems");
    const topSch = document.getElementById("topScholarships");
    const preds = document.getElementById("recentPreds");
    const resumeSection = document.getElementById("resumeSection");

    topSch.innerHTML = skeleton(3).join("");
    preds.innerHTML = skeleton(3).join("");
    resumeSection.innerHTML = skeleton(3).join("");
    actionItemsEl.innerHTML = `<div class="item skeleton" style="height:42px"></div>`;

    try {
      // Fetch critical data first (parallel)
      const [comp, profile, resumes] = await Promise.all([
        fetchAPI("/api/profile/completeness"),
        fetchAPI("/api/profile"),
        fetchAPI("/api/resumes"),
      ]);

      // Render profile section immediately
      const pct = Number(comp.percent || 0);
      document.getElementById("completePct").textContent = `${pct}%`;

      // Missing fields as readable badge tags
      const missingEl = document.getElementById("missingTop");
      const missingFields = (comp.missing || []).slice(0, 6);
      if (missingFields.length) {
        missingEl.innerHTML = missingFields.map((f) => `<span class="badge warning" style="font-size:11px;margin:2px 2px 4px 0">${f}</span>`).join("");
      } else {
        missingEl.innerHTML = `<span class="badge success" style="font-size:11px">Profile complete 🎉</span>`;
      }

      if (window.Chart) {
        const ctxComp = document.getElementById("completenessChart").getContext("2d");
        // eslint-disable-next-line no-new
        new window.Chart(ctxComp, {
          type: "doughnut",
          data: {
            datasets: [
              {
                data: [pct, 100 - pct],
                backgroundColor: ["#f8cf2f", "rgba(33, 29, 18, 0.08)"],
                borderColor: ["#211d12", "transparent"],
                borderWidth: [2, 0],
                hoverOffset: 0,
              },
            ],
          },
          options: {
            cutout: "70%",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
            },
          },
        });
      }

      const p = profile.profile || {};
      document.getElementById("profileScore").textContent = p.overall_profile_score ? `${Math.round(p.overall_profile_score)}/100` : "—";

      const dims = [
        p.academic_score || 0,
        p.test_score || 0,
        p.work_exp_score || 0,
        p.research_score || 0,
        p.extracurric_score || 0,
        p.financial_health_score || 0,
      ];

      if (window.Chart) {
        const ctx = document.getElementById("radarChart").getContext("2d");
        // eslint-disable-next-line no-new
        new window.Chart(ctx, {
          type: "radar",
          data: {
            labels: ["Academics", "Tests", "Work", "Research", "Extra", "Finance"],
            datasets: [
              {
                data: dims,
                borderColor: "#211d12",
                backgroundColor: "rgba(248, 207, 47, 0.4)",
                borderWidth: 2,
                pointBackgroundColor: "#f8cf2f",
                pointBorderColor: "#211d12",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "#211d12",
                titleColor: "#fff",
                bodyColor: "#fff",
                cornerRadius: 8,
                padding: 10,
                displayColors: false,
              },
            },
            scales: {
              r: {
                min: 0,
                max: 100,
                beginAtZero: true,
                ticks: { display: false, stepSize: 25 },
                angleLines: {
                  display: true,
                  color: "rgba(33, 29, 18, 0.15)",
                  lineWidth: 1,
                },
                grid: {
                  color: "rgba(33, 29, 18, 0.15)",
                  lineWidth: 1,
                },
                pointLabels: {
                  color: "#17140d",
                  font: {
                    family: "Inter, sans-serif",
                    size: 11,
                    weight: "700",
                  },
                  padding: 10,
                },
              },
            },
          },
        });
      }

      document.getElementById("statResumes").textContent = (resumes.resumes || []).length;

      // Fetch non-critical data (parallel, don't block)
      const [predList, matched] = await Promise.all([
        fetchAPI("/api/predictions").catch(() => ({ predictions: [] })),
        fetchAPI("/api/scholarships/matched").catch(() => ({ matched: [] })),
      ]);

      document.getElementById("statPreds").textContent = (predList.predictions || []).length;
      document.getElementById("statSch").textContent = (matched.matched || []).length;

      const actions = [];
      if (pct < 60) actions.push("Finish onboarding to improve prediction accuracy.");
      if (!(resumes.resumes || []).length) actions.push("Upload a resume to unlock AI resume scoring.");
      if (!(predList.predictions || []).length) actions.push("Run 2–3 predictions to calibrate your shortlist.");
      if (!actions.length) actions.push("Review your weakest radar dimension and improve it this week.");
      actionItemsEl.innerHTML = actions.slice(0, 3).map((a) => `<div class="item">${a}</div>`).join("");

      const top = (matched.matched || []).slice(0, 3);
      topSch.innerHTML = top.length
        ? top
            .map((s) =>
              card(
                s.name,
                `${s.provider || ""} • ${(s.deadline || "").toString() || "deadline varies"}`,
                `<span class="badge success">${formatINR(s.total_value_inr || 0)}</span>`,
              ),
            )
            .join("")
        : `<div class="caption muted">No matches yet. Complete your profile for better results.</div>`;

      const recent = (predList.predictions || []).slice(0, 3);
      preds.innerHTML = recent.length
        ? recent
            .map((p) =>
              card(
                `${Math.round((p.admit_probability || 0) * 100)}% • ${p.admit_category || ""}`,
                `${p.course_name || ""} • ${p.university_name || ""}`,
              ),
            )
            .join("")
        : `<div class="caption muted">No predictions yet.</div>`;

      // Resume section
      const resumeList = (resumes.resumes || []).slice(0, 3);
      if (!resumeList.length) {
        resumeSection.innerHTML = `
          <div class="card pad" style="grid-column:1/-1">
            <div class="caption muted" style="margin-bottom:12px">No resumes uploaded yet. Upload a PDF to get AI scoring and use it in admit predictions.</div>
            <a class="btn primary sm" href="/resume">Upload your first resume →</a>
          </div>`;
      } else {
        resumeSection.innerHTML = resumeList
          .map((r) => {
            const isPrimary = r.is_primary ? `<span class="badge info" style="font-size:11px">Primary</span>` : "";
            const status = r.analysis_status === "done"
              ? resumeScoreBadge(r.ai_score_overall)
              : r.analysis_status === "pending"
              ? `<span class="badge warning">Analyzing…</span>`
              : `<span class="badge">Pending</span>`;
            const summary = r.ai_feedback_summary
              ? `<div class="caption muted" style="margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${r.ai_feedback_summary}</div>`
              : "";
            return `
              <a class="card pad" href="/resume" style="display:block;text-decoration:none">
                <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
                  <div class="h3" style="word-break:break-word;flex:1">${r.file_name || "Resume"}</div>
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">${status}${isPrimary}</div>
                </div>
                ${summary}
                <div class="caption muted" style="margin-top:8px">${r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : ""}</div>
              </a>`;
          })
          .join("");
        if ((resumes.resumes || []).length > 3) {
          resumeSection.innerHTML += `<a class="card pad" href="/resume" style="display:flex;align-items:center;justify-content:center;text-decoration:none"><span class="caption">View all ${(resumes.resumes || []).length} resumes →</span></a>`;
        }
      }

      // Forex badge (non-blocking, load last)
      fetchAPI("/api/countries").then((data) => {
        const usd = (data.countries || []).find((c) => c.currency === "USD");
        document.getElementById("forexBadge").textContent = usd?.exchange_rate_to_inr
          ? `1 USD = ₹${Number(usd.exchange_rate_to_inr).toFixed(2)}`
          : "Forex unavailable";
      }).catch(() => {
        document.getElementById("forexBadge").textContent = "Forex unavailable";
      });

    } catch (e) {
      showToast(e.message || "Dashboard failed to load", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();

