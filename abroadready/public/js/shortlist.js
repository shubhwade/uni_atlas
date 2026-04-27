(() => {
  const { showToast, shortlist } = window.AbroadReady;

  function render() {
    const state = shortlist.get();
    const root = document.getElementById("kanban");
    if (!root) return;

    root.innerHTML = shortlist.columns
      .map((c) => {
        const items = state[c] || [];
        return `
          <div class="col">
            <div class="colHead">
              <div class="h3">${c}</div>
              <button class="btn sm" data-add="${c}" type="button">Add</button>
            </div>
            <div class="colBody" data-col="${c}">
              ${items
                .map((it) => {
                  const href = it.is_global ? (it.website || "#") : (it.slug ? `/university-detail?slug=${encodeURIComponent(it.slug)}` : "#");
                  const target = it.is_global ? 'target="_blank"' : "";
                  return `
                    <div class="kcard" data-id="${it.id}" data-slug="${it.slug || ""}" data-website="${it.website || ""}" data-is-global="${!!it.is_global}">
                      <div class="row" style="justify-content:space-between;align-items:flex-start">
                        <a href="${href}" ${target} class="h3" style="font-size:0.95rem;margin:0;text-decoration:none;color:inherit;display:block;flex:1">${it.title}</a>
                        <button class="btn sm delete-btn" style="padding:2px 6px;line-height:1;margin-left:4px" data-id="${it.id}" data-col="${c}">×</button>
                      </div>
                      <div class="caption muted">${it.note || ""}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");

    shortlist.columns.forEach((c) => {
      // eslint-disable-next-line no-undef
      new Sortable(root.querySelector(`[data-col="${c}"]`), {
        group: "shortlist",
        animation: 180,
        onEnd: async () => {
          const next = {};
          shortlist.columns.forEach((cc) => {
            next[cc] = Array.from(root.querySelectorAll(`[data-col="${cc}"] .kcard`)).map((el) => {
              const id = el.getAttribute("data-id");
              const title = el.querySelector(".h3")?.textContent || "";
              const note = el.querySelector(".caption")?.textContent || "";
              const slug = el.getAttribute("data-slug");
              const website = el.getAttribute("data-website");
              const is_global = el.getAttribute("data-is-global") === "true";
              return { id, title, note, slug, website, is_global };
            });
          });
          await shortlist.save(next);
        },
      });
    });
  }

  document.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn) {
      const { id, col } = delBtn.dataset;
      const state = shortlist.get();
      if (state[col]) {
        state[col] = state[col].filter(it => String(it.id) !== String(id));
        await shortlist.save(state);
        render();
        showToast("Removed from shortlist", "info");
      }
      return;
    }

    const btn = e.target.closest("button[data-add]");
    if (!btn) return;
    const col = btn.dataset.add;
    const title = prompt("Course name / note?");
    if (!title) return;
    
    if (await shortlist.add(col, String(Date.now()), title, "")) {
      render();
      showToast("Added", "success");
    }
  });

  // Modal Search Logic
  const modal = document.getElementById("uniSearchModal");
  const openBtn = document.getElementById("openSearchBtn");
  const closeBtn = document.getElementById("closeSearchBtn");
  const searchBtn = document.getElementById("doGlobalSearch");
  const searchInput = document.getElementById("globalUniInput");
  const resultsDiv = document.getElementById("globalUniResults");

  if (openBtn) {
    openBtn.addEventListener("click", () => modal.classList.add("open"));
    closeBtn.addEventListener("click", () => modal.classList.remove("open"));

    searchBtn.addEventListener("click", async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) return;
      resultsDiv.innerHTML = '<div class="caption">Searching...</div>';
      try {
        const { fetchAPI } = window.AbroadReady;
        const data = await fetchAPI(`/api/universities/global-search?q=${encodeURIComponent(q)}`);
        if (!data.universities || data.universities.length === 0) {
          resultsDiv.innerHTML = '<div class="caption">No results found.</div>';
          return;
        }
        resultsDiv.innerHTML = data.universities.map(u => `
          <div class="card pad row" style="justify-content:space-between;align-items:center;margin-bottom:0.5rem">
            <div>
              <div class="h3" style="font-size:1rem">${u.name}</div>
              <div class="caption muted">${u.country_name}</div>
            </div>
            <button class="btn sm modal-add-btn" 
              data-id="${u.id}" 
              data-name="${u.name}" 
              data-country="${u.country_name}"
              data-website="${u.website || ""}"
              data-is-global="true">Add</button>
          </div>
        `).join("");

        resultsDiv.querySelectorAll(".modal-add-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const meta = {
              website: btn.dataset.website || null,
              is_global: true
            };
            if (await shortlist.add("Researching", btn.dataset.id, btn.dataset.name, btn.dataset.country, meta)) {
              btn.textContent = "Added";
              btn.disabled = true;
              showToast("Added to shortlist", "success");
              render();
            } else {
              showToast("Already in shortlist", "info");
            }
          });
        });
      } catch (e) {
        resultsDiv.innerHTML = `<div class="caption error">Search failed: ${e.message}</div>`;
      }
    });
  }

  // Sync and initial render
  window.addEventListener("shortlistUpdated", () => {
    render();
  });

  render();
})();

