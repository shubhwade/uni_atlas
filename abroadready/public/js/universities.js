(() => {
  const { fetchAPI, skeleton, formatINR, showToast } = window.AbroadReady;

  let page = 1;
  let pages = 1;

  const grid = document.getElementById("grid");
  const pageInfo = document.getElementById("pageInfo");

  async function loadCountries() {
    const data = await fetchAPI("/api/countries");
    const sel = document.getElementById("country");
    for (const c of data.countries || []) {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.flag_emoji || ""} ${c.name}`;
      sel.appendChild(opt);
    }
  }

  function uniCard(u) {
    const isGlobal = !!u.is_global;
    const href = isGlobal ? (u.website || "#") : `/university-detail?slug=${encodeURIComponent(u.slug)}`;
    const rank = u.qs_ranking_world ? `QS #${u.qs_ranking_world}` : (isGlobal ? "Global Data" : "QS —");
    const minCoa = u.min_coa_inr ? formatINR(u.min_coa_inr) : "—";
    
    // Check if already in shortlist
    const { shortlist } = window.AbroadReady;
    const state = shortlist ? shortlist.get() : {};
    const allItems = Object.values(state).flat();
    const isAdded = allItems.some(it => String(it.id) === String(u.id));
    
    return `
      <div class="card pad uniCard">
        <a href="${href}" ${isGlobal ? 'target="_blank"' : ""} style="text-decoration:none;color:inherit">
          <div class="uniTop">
            <div>
              <div class="h3">${u.name}</div>
              <div class="caption muted">${u.city || ""} ${u.city ? "•" : ""} ${u.country_name || ""}</div>
            </div>
            <span class="badge ${isGlobal ? 'warning' : 'info'}">${rank}</span>
          </div>
          <div class="uniMeta">
            ${isGlobal ? "" : `<span class="badge">${u.university_type || "type"}</span>`}
            ${isGlobal ? "" : `<span class="badge">Min COA: ${minCoa}</span>`}
            ${!isGlobal && u.overall_placement_rate ? `<span class="badge success">Placement ~${Math.round(u.overall_placement_rate)}%</span>` : ""}
            ${isGlobal ? `<span class="badge info">External API</span>` : ""}
          </div>
        </a>
        <div class="spacer" style="height:12px"></div>
        <button class="btn primary sm w-100 add-shortlist" 
          ${isAdded ? "disabled" : ""}
          data-id="${u.id}" 
          data-name="${u.name}" 
          data-country="${u.country_name || ""}"
          data-slug="${u.slug || ""}"
          data-website="${u.website || ""}"
          data-is-global="${isGlobal}">${isAdded ? "✓ Added" : "+ Add to Shortlist"}</button>
      </div>
    `;
  }

  async function load() {
    const q = document.getElementById("search").value.trim();
    const country = document.getElementById("country").value;
    const sortBy = document.getElementById("sort").value;
    const isGlobalSearch = document.getElementById("globalSearch")?.checked;

    grid.innerHTML = skeleton(6).join("");
    
    // Update UI state based on global search
    const filterSection = document.querySelector(".filters");
    if (isGlobalSearch) {
      filterSection.classList.add("global-active");
      document.getElementById("country").disabled = true;
      document.getElementById("sort").disabled = true;
    } else {
      filterSection.classList.remove("global-active");
      document.getElementById("country").disabled = false;
      document.getElementById("sort").disabled = false;
    }

    try {
      let data;
      const isGlobalChecked = isGlobalSearch;
      
      if (isGlobalChecked) {
        if (q.length < 2) {
          grid.innerHTML = `<div class="card pad" style="grid-column: 1 / -1; text-align: center;">
            <div class="h3">Enter at least 2 characters to search globally</div>
            <p class="muted">We'll search thousands of universities across the world.</p>
          </div>`;
          pageInfo.textContent = "";
          return;
        }
        data = await fetchAPI(`/api/universities/global-search?q=${encodeURIComponent(q)}`);
        pages = 1;
        pageInfo.textContent = `Found ${data.universities?.length || 0} universities globally`;
      } else {
        data = await fetchAPI(
          `/api/universities?search=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}&sortBy=${encodeURIComponent(sortBy)}&page=${page}&limit=9`,
        );
        pages = data.pages || 1;
        pageInfo.textContent = `Page ${data.page} / ${pages} • ${data.total} results`;
        
        // Proactive: If no local results, and user didn't check global, suggest global
        if ((data.universities || []).length === 0 && q.length >= 2 && !isGlobalChecked) {
          grid.innerHTML = `
            <div class="card pad" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
              <div class="h3" style="font-size: 1.5rem; margin-bottom: 0.5rem;">No local matches for "${q}"</div>
              <p class="muted" style="margin-bottom: 1.5rem;">We couldn't find this in our curated database. Try searching all universities in the world?</p>
              <button class="btn primary lg" id="tryGlobal" style="padding: 0.8rem 2rem; font-size: 1rem;">Search Globally</button>
            </div>
          `;
          document.getElementById("tryGlobal").addEventListener("click", () => {
            document.getElementById("globalSearch").checked = true;
            load();
          });
          return;
        }
      }
      
      grid.innerHTML = (data.universities || []).map(uniCard).join("") || `<div class="caption muted">No results.</div>`;
      
      // Bind shortlist buttons
      grid.querySelectorAll(".add-shortlist").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          const { id, name, country, slug, website, isGlobal } = btn.dataset;
          const { shortlist } = window.AbroadReady;
          const meta = {
            slug: slug || null,
            website: website || null,
            is_global: isGlobal === "true"
          };
          if (shortlist && await shortlist.add("Researching", id, name, country, meta)) {
            showToast(`Added ${name} to shortlist`, "success");
            btn.textContent = "✓ Added";
            btn.disabled = true;
          } else {
            showToast(`${name} is already in your shortlist`, "info");
          }
        });
      });
    } catch (e) {
      grid.innerHTML = `<div class="card pad"><div class="h3">Failed to load</div><div class="caption muted">${e.message}</div></div>`;
    }
  }

  document.getElementById("apply").addEventListener("click", () => {
    page = 1;
    load();
  });
  document.getElementById("prev").addEventListener("click", () => {
    page = Math.max(1, page - 1);
    load();
  });
  document.getElementById("next").addEventListener("click", () => {
    page = Math.min(pages, page + 1);
    load();
  });

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadCountries();
      await load();
    } catch (e) {
      showToast(e.message || "Init failed", "error");
    }
  });
})();

