(() => {
  const { fetchAPI, showToast, skeleton } = window.AbroadReady;
  const status = document.getElementById("status");
  const out = document.getElementById("out");

  async function poll(id) {
    for (let i = 0; i < 40; i += 1) {
      const data = await fetchAPI(`/api/portfolios/${id}`);
      const s = data.portfolio.crawl_status;
      if (s === "done" || s === "failed") return data.portfolio;
      await new Promise((r) => setTimeout(r, 4000));
    }
    return null;
  }

  document.getElementById("analyze").addEventListener("click", async () => {
    const url = document.getElementById("url").value.trim();
    if (!url) return showToast("Enter a URL", "info");
    out.innerHTML = skeleton(2).join("");
    status.textContent = "Crawling...";
    try {
      const r = await fetchAPI("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const p = await poll(r.portfolioId);
      if (!p) throw new Error("Portfolio analysis is taking longer than expected. Please refresh in a minute.");
      status.textContent = p.crawl_status === "done" ? "Done." : "Failed.";
      out.innerHTML =
        p.crawl_status === "done"
          ? `
            ${p.screenshot_url ? `<img class="shot" src="${p.screenshot_url}" alt="Portfolio screenshot" />` : ""}
            <div class="card pad">
              <div class="h3">Scores</div>
              <div class="caption muted">Design ${p.design_score}/10 - Technical ${p.technical_score}/10 - Content ${p.content_score}/10</div>
              <div class="spacer"></div>
              <div class="caption muted">${p.ai_summary || ""}</div>
            </div>
          `
          : `<div class="card pad"><div class="h3">Failed</div><div class="caption muted">${p.improvement_tips || ""}</div></div>`;
    } catch (e) {
      status.textContent = "";
      showToast(e.message || "Analyze failed", "error");
    }
  });
})();
