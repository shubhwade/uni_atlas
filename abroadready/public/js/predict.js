(() => {
  const { fetchAPI, showToast, debounce, skeleton } = window.AbroadReady;

  const selected = new Map(); // courseId -> course
  const resultsEl = document.getElementById("results");
  const courseResultsEl = document.getElementById("courseResults");
  const selectedEl = document.getElementById("selected");

  function renderSelected() {
    selectedEl.innerHTML = Array.from(selected.values())
      .map(
        (c) => `
        <div class="card pad chipBtn">
          <div>
            <div class="h3">${c.name}</div>
            <div class="caption muted">${c.university_name || ""}</div>
          </div>
          <button class="btn sm" data-remove="${c.id}" type="button">Remove</button>
        </div>`,
      )
      .join("");
  }

  function renderCourseResults(rows) {
    courseResultsEl.innerHTML = rows
      .map(
        (c) => `
        <div class="card pad chipBtn">
          <div>
            <div class="h3">${c.name}</div>
            <div class="caption muted">${c.university_name || ""}</div>
          </div>
          <button class="btn sm" data-add="${c.id}" type="button">Add</button>
        </div>`,
      )
      .join("");
  }

  async function search(q) {
    if (!q) {
      courseResultsEl.innerHTML = "";
      return;
    }
    courseResultsEl.innerHTML = skeleton(3).join("");
    const data = await fetchAPI(`/api/courses?limit=10&sortBy=tuition`);
    const rows = (data.courses || []).filter((c) => (c.name || "").toLowerCase().includes(q.toLowerCase())).slice(0, 10);
    renderCourseResults(rows);
  }

  async function runAll() {
    const ids = Array.from(selected.keys());
    if (!ids.length) return showToast("Select at least 1 course", "info");
    resultsEl.innerHTML = skeleton(4).join("");
    const data = await fetchAPI("/api/predictions/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: ids }),
    });

    const categoryColors = { Safety: "success", Moderate: "info", Reach: "warning", Dream: "danger" };
    const sections = [];
    for (const k of ["Safety", "Moderate", "Reach", "Dream"]) {
      const arr = data.results[k] || [];
      if (!arr.length) continue;
      sections.push(`
        <div class="card pad">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="h2">${k}</div>
            <span class="badge ${categoryColors[k]}">${arr.length} course${arr.length !== 1 ? "s" : ""}</span>
          </div>
          <div class="spacer"></div>
          <div class="grid" style="gap:10px">
            ${arr.map((r) => {
              const pct = Math.round((r.finalProbability || 0) * 100);
              const course = selected.get(r.courseId);
              const name = course?.name || `Course #${r.courseId}`;
              const uni = course?.university_name || "";
              const strengths = (r.ai?.strengths || []).slice(0, 2).join(" · ");
              const gaps = (r.ai?.gaps || []).slice(0, 1).join("");
              return `
                <div class="card pad" style="background:var(--bg)">
                  <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
                    <div>
                      <div class="h3">${name}</div>
                      <div class="caption muted">${uni}</div>
                    </div>
                    <span class="badge ${categoryColors[k]}" style="flex-shrink:0">${pct}%</span>
                  </div>
                  ${strengths ? `<div class="caption muted" style="margin-top:8px">✓ ${strengths}</div>` : ""}
                  ${gaps ? `<div class="caption muted" style="margin-top:4px">↑ ${gaps}</div>` : ""}
                  <div class="caption muted" style="margin-top:6px">${r.ai?.confidenceLevel || ""} confidence</div>
                </div>`;
            }).join("")}
          </div>
        </div>
      `);
    }
    if (!sections.length) {
      resultsEl.innerHTML = `<div class="card pad" style="grid-column:1/-1"><div class="caption muted">No results returned. Make sure your profile is complete.</div></div>`;
    } else {
      resultsEl.innerHTML = sections.join("");
    }
  }

  document.getElementById("courseSearch").addEventListener(
    "input",
    debounce((e) => search(e.target.value.trim()).catch((err) => showToast(err.message, "error")), 220),
  );

  courseResultsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-add]");
    if (!btn) return;
    if (selected.size >= 10) return showToast("Max 10 courses", "info");
    const id = Number(btn.dataset.add);
    const data = await fetchAPI(`/api/courses/${id}`);
    selected.set(id, { id, name: data.course.name, university_name: data.course.university_name });
    renderSelected();
  });

  selectedEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-remove]");
    if (!btn) return;
    selected.delete(Number(btn.dataset.remove));
    renderSelected();
  });

  document.getElementById("runAll").addEventListener("click", () => runAll().catch((e) => showToast(e.message, "error")));

  document.addEventListener("DOMContentLoaded", () => renderSelected());
})();

