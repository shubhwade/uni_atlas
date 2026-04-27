(() => {
  const { fetchAPI, showToast, showModal, skeleton, timeAgo } = window.AbroadReady;
  const postsEl = document.getElementById("posts");

  function postCard(p) {
    return `
      <div class="card pad">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="h3">${p.title}</div>
            <div class="caption muted">${p.category} • ${(p.country_code || "").toUpperCase()} • ${timeAgo(p.created_at)}</div>
          </div>
          <span class="badge info">▲ ${p.upvotes || 0}</span>
        </div>
        <div class="spacer"></div>
        <div class="caption muted">${String(p.content || "").slice(0, 180)}${String(p.content || "").length > 180 ? "…" : ""}</div>
        <div class="spacer"></div>
        <div class="row wrap">
          <button class="btn sm" data-open="${p.id}" type="button">Open</button>
          <button class="btn sm" data-up="${p.id}" type="button">Upvote</button>
        </div>
      </div>
    `;
  }

  async function load() {
    const cat = document.getElementById("cat").value;
    const cc = document.getElementById("cc").value.trim();
    postsEl.innerHTML = skeleton(4).join("");
    const data = await fetchAPI(`/api/community?category=${encodeURIComponent(cat)}&countryCode=${encodeURIComponent(cc)}&sortBy=recent&page=1`);
    postsEl.innerHTML = (data.posts || []).map(postCard).join("") || `<div class="caption muted">No posts.</div>`;
  }

  document.getElementById("apply").addEventListener("click", () => load().catch((e) => showToast(e.message, "error")));

  document.getElementById("newPost").addEventListener("click", () => {
    showModal(
      "Write a post",
      `
        <div class="grid">
          <label class="caption">Category</label>
          <select class="select" id="npCat">
            <option>Admit Stories</option>
            <option>Expense Reports</option>
            <option>Loan Reviews</option>
            <option>Visa Tips</option>
            <option>Housing</option>
            <option>General</option>
          </select>
          <label class="caption">Country code</label>
          <input class="input" id="npCC" placeholder="usa" />
          <label class="caption">Title</label>
          <input class="input" id="npTitle" />
          <label class="caption">Content</label>
          <textarea class="textarea" id="npBody" rows="6"></textarea>
          <button class="btn primary" id="npSubmit" type="button">Post</button>
        </div>
      `,
    );

    document.getElementById("npSubmit").addEventListener("click", async () => {
      try {
        await fetchAPI("/api/community", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: document.getElementById("npCat").value,
            country_code: document.getElementById("npCC").value.trim(),
            title: document.getElementById("npTitle").value.trim(),
            content: document.getElementById("npBody").value.trim(),
          }),
        });
        window.AbroadReady.closeModal();
        showToast("Posted", "success");
        await load();
      } catch (e) {
        showToast(e.message || "Post failed", "error");
      }
    });
  });

  postsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    try {
      if (btn.dataset.open) {
        const data = await fetchAPI(`/api/community/${btn.dataset.open}`);
        const p = data.post || {};
        showModal(p.title || "Post", `
          <div>
            <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <span class="badge info">${p.category || ""}</span>
              ${p.country_code ? `<span class="badge">${(p.country_code || "").toUpperCase()}</span>` : ""}
              <span class="badge">▲ ${p.upvotes || 0}</span>
              <span class="caption muted" style="margin-left:auto">${timeAgo(p.created_at || "")}</span>
            </div>
            <div style="white-space:pre-wrap;line-height:1.6;font-size:14px">${p.content || ""}</div>
          </div>
        `);
      }
      if (btn.dataset.up) {
        await fetchAPI(`/api/community/${btn.dataset.up}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "up" }),
        });
        showToast("Upvoted", "success");
        await load();
      }
    } catch (err) {
      showToast(err.message || "Action failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message, "error")));
})();

