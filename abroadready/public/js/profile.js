(() => {
  const { fetchAPI, showToast, showModal } = window.AbroadReady;

  const tabNames = ["Academic", "Tests", "Work", "Financial", "Preferences"];
  let active = tabNames[0];

  const tabs = document.getElementById("tabs");
  const panels = document.getElementById("panels");
  const scoresNote = document.getElementById("scoresNote");

  function setActive(name) {
    active = name;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    panels.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.dataset.tab === name));
  }

  function getPayload() {
    const payload = {};
    document.querySelectorAll("#panels input[name], #panels select[name], #panels textarea[name]").forEach((el) => {
      const k = el.name;
      payload[k] = el.type === "number" ? (el.value ? Number(el.value) : null) : el.value;
    });
    return payload;
  }

  async function load() {
    tabs.innerHTML = tabNames.map((n) => `<button class="tab" type="button" data-tab="${n}">${n}</button>`).join("");
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (btn) setActive(btn.dataset.tab);
    });
    setActive(active);

    const data = await fetchAPI("/api/profile");
    const p = data.profile || {};
    document.querySelectorAll("#panels input[name], #panels select[name], #panels textarea[name]").forEach((el) => {
      if (p[el.name] === null || p[el.name] === undefined) return;
      el.value = String(p[el.name]);
    });
    scoresNote.textContent = p.last_analyzed_at ? `Last scored ${p.last_analyzed_at}` : "Scores not computed yet.";
  }

  document.getElementById("saveBtn")?.addEventListener("click", async () => {
    try {
      const data = await fetchAPI("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPayload()),
      });
      const p = data.profile || {};
      scoresNote.textContent = p.last_analyzed_at ? `Last scored ${p.last_analyzed_at}` : "Scores not computed yet.";
      showToast("Profile Updated & Scores Recalculated", "success");
    } catch (e) {
      showToast(e.message || "Save failed", "error");
    }
  });

  document.getElementById("recomputeBtn")?.addEventListener("click", async () => {
    try {
      const r = await fetchAPI("/api/profile/recompute-scores", { method: "POST" });
      showToast("Scores recomputed", "success");
      const scores = r.scores || {};
      const rows = Object.entries(scores)
        .map(([k, v]) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(23,20,13,.08)"><span class="caption">${k}</span><span class="badge info">${typeof v === "number" ? Math.round(v) : v}</span></div>`)
        .join("");
      showModal("AI Scores", `<div>${rows || "<div class='caption muted'>No scores returned.</div>"}</div>`);
    } catch (e) {
      showToast(e.message || "Failed", "error");
    }
  });

  document.getElementById("improveBtn")?.addEventListener("click", () => {
    const tips = {
      Academic: [
        "Add your university tier (tier1/tier2) — it directly affects your academic score.",
        "If your GPA is below 3.5/4.0, highlight strong upward trends in your SOP.",
        "Add your 10th and 12th board scores in onboarding for a complete academic picture.",
      ],
      Tests: [
        "GRE Quant \u2265 165 is the threshold for top-10 CS programs. Retake if below 160.",
        "IELTS \u2265 7.0 or TOEFL \u2265 100 is required by most UK/Canada universities.",
        "Duolingo is accepted by 3000+ universities and is cheaper to retake than TOEFL.",
      ],
      Work: [
        "Add your GitHub URL — it's checked by admissions for CS/Engineering programs.",
        "Work experience > 24 months significantly boosts MBA and MEng admit chances.",
        "List specific projects with measurable outcomes (e.g., 'reduced latency by 40%').",
      ],
      Financial: [
        "CIBIL \u2265 750 unlocks better loan rates from SBI, HDFC Credila, and Axis Bank.",
        "Savings \u2265 10L shows financial readiness and reduces loan dependency.",
        "A co-applicant with stable income (LPA \u2265 6L) improves loan approval odds.",
      ],
      Preferences: [
        "Targeting 3+ countries increases your scholarship match count significantly.",
        "Set a realistic budget — most MS programs in the US cost \u20b940\u201370L total.",
        "Apply for Fall intake (Aug/Sep) — it has 3\u00d7 more seats than Spring.",
      ],
    };
    const list = (tips[active] || []).map((t) => `<li style="margin-bottom:10px;font-size:14px">${t}</li>`).join("");
    showModal(`Improve: ${active}`, `<ul style="margin:0;padding-left:18px">${list}</ul>`);
  });

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message || "Load failed", "error")));
})();
