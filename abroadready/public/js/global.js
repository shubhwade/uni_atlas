(() => {
  const toastContainerId = "toastContainer";
  const modalOverlayId = "modalOverlay";

  function ensureToastContainer() {
    let el = document.getElementById(toastContainerId);
    if (!el) {
      el = document.createElement("div");
      el.id = toastContainerId;
      el.className = "toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  function ensureModal() {
    let overlay = document.getElementById(modalOverlayId);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = modalOverlayId;
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Modal">
          <div class="modal__head">
            <div id="modalTitle" class="h3">Modal</div>
            <button class="btn sm" id="modalClose" type="button">Close</button>
          </div>
          <div class="modal__body" id="modalBody"></div>
        </div>
      `;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
      document.body.appendChild(overlay);
      overlay.querySelector("#modalClose").addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }
    return overlay;
  }

  function showToast(message, type = "info") {
    const c = ensureToastContainer();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = String(message || "");
    c.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(-2px)";
      setTimeout(() => t.remove(), 260);
    }, 2600);
  }

  function showModal(title, contentHTML) {
    const overlay = ensureModal();
    overlay.querySelector("#modalTitle").textContent = String(title || "");
    // FIX: Use textContent for user data, only use innerHTML for trusted internal HTML
    // If you need to display HTML, sanitize it first
    if (typeof contentHTML === 'string' && contentHTML.includes('<')) {
      // SECURITY: Only use innerHTML for trusted internal content
      // For user-generated content, use textContent
      overlay.querySelector("#modalBody").textContent = String(contentHTML || "");
    } else {
      overlay.querySelector("#modalBody").textContent = String(contentHTML || "");
    }
    overlay.classList.add("open");
  }

  // Helper: Escape HTML special characters (prevent XSS)
  function escapeHTML(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }

  function closeModal() {
    const overlay = document.getElementById(modalOverlayId);
    if (overlay) overlay.classList.remove("open");
  }

  function timeAgo(dateString) {
    const t = Date.parse(dateString);
    if (!Number.isFinite(t)) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function formatINR(num) {
    const n = Number(num || 0);
    return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  }

  function formatLocal(num, currency, symbol) {
    const n = Number(num || 0);
    const ccy = String(currency || "").toUpperCase();
    try {
      return n.toLocaleString(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 0 });
    } catch {
      return `${symbol || ""}${n.toFixed(0)}`;
    }
  }

  function debounce(fn, delay) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function skeleton(n) {
    return Array.from({ length: n }).map(() => `<div class="card pad skeleton" style="height:92px"></div>`);
  }

  async function fetchAPI(endpoint, options = {}) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    try {
      const resp = await fetch(endpoint, { ...options, signal: ctrl.signal, credentials: "include" });
      const isJson = (resp.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await resp.json().catch(() => ({})) : await resp.text();
      if (!resp.ok) {
        const msg = isJson ? data?.error || "Request failed" : "Request failed";
        const err = new Error(msg);
        err.status = resp.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Request timed out (15s)");
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function ensureAuthIfRequired() {
    const requires = document.body.getAttribute("data-requires-auth") === "1";
    if (!requires) return { authed: false };
    try {
      const me = await fetchAPI("/auth/me");
      return { authed: true, user: me.user };
    } catch {
      window.location.href = "/login";
      return { authed: false };
    }
  }

  async function loadForexTicker() {
    const el = document.querySelector("[data-forex]");
    if (!el) return;
    try {
      const data = await fetchAPI("/api/countries");
      const usd = data?.countries?.find((c) => c.currency === "USD");
      if (usd?.exchange_rate_to_inr) {
        el.textContent = `1 USD = ₹${Number(usd.exchange_rate_to_inr).toFixed(2)}`;
      } else {
        el.textContent = "Forex unavailable";
      }
    } catch {
      el.textContent = "Forex unavailable";
    }
  }

  function setActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll(".nav-links a, .mobile-bottom-nav a").forEach((a) => {
      if (a.getAttribute("href") === path) a.classList.add("active");
    });
  }

  function injectNav(user) {
    const mount = document.getElementById("appNav");
    if (!mount) return;
    mount.innerHTML = `
      <header class="nav-wrap">
        <nav class="nav container" aria-label="Primary">
          <a class="brand" href="/dashboard" aria-label="AbroadReady">
            <span class="brand__mark" aria-hidden="true"></span>
            <span>AbroadReady</span>
          </a>
          <div class="nav-links">
            <a href="/dashboard">Dashboard</a>
            <a href="/universities">Universities</a>
            <a href="/shortlist">Shortlist</a>
            <a href="/resume">Resume</a>
            <a href="/finance">Finance</a>
            <a href="/profile">Profile</a>
            <a href="/community">Community</a>
          </div>
          <div class="nav-right">
            <span class="nav-pill" data-forex>Loading forex…</span>
            <a class="btn sm" href="/notifications">Notifications</a>
            ${
              user
                ? `<span class="nav-pill">${(user.name || user.email || "").slice(0, 20)}</span>
                   <button class="btn sm" id="logoutBtn" type="button">Logout</button>`
                : `<a class="btn sm" href="/login">Sign in</a>`
            }
          </div>
        </nav>
      </header>
      <div class="mobile-bottom-nav">
        <div class="container">
          <div class="items">
            <a href="/dashboard">Dashboard</a>
            <a href="/universities">Search</a>
            <a href="/resume">Resume</a>
            <a href="/shortlist">Shortlist</a>
            <a href="/profile">Profile</a>
          </div>
        </div>
      </div>
    `;

    const btn = document.getElementById("logoutBtn");
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          await fetchAPI("/auth/logout", { method: "POST" });
          window.location.href = "/login";
        } catch (e) {
          showToast(e.message || "Logout failed", "error");
        }
      });
    }
  }

  // Cmd/Ctrl+K global search (basic overlay)
  function bindGlobalSearch() {
    const overlayId = "globalSearchOverlay";
    const ensure = () => {
      let el = document.getElementById(overlayId);
      if (el) return el;
      el = document.createElement("div");
      el.id = overlayId;
      el.className = "modal-overlay";
      el.innerHTML = `
        <div class="modal">
          <div class="modal__head">
            <div class="h3">Search</div>
            <button class="btn sm" id="gsClose" type="button">Close</button>
          </div>
          <div class="modal__body">
            <input class="input" id="gsInput" placeholder="Search universities, courses, scholarships, countries…" />
            <div class="spacer"></div>
            <div id="gsResults" class="grid"></div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      el.querySelector("#gsClose").addEventListener("click", () => el.classList.remove("open"));
      el.addEventListener("click", (e) => {
        if (e.target === el) el.classList.remove("open");
      });
      return el;
    };

    const open = () => {
      const el = ensure();
      el.classList.add("open");
      const input = el.querySelector("#gsInput");
      input.value = "";
      input.focus();
      el.querySelector("#gsResults").innerHTML = "";
    };

    const search = debounce(async (q) => {
      const el = ensure();
      const resultsEl = el.querySelector("#gsResults");
      if (!q) {
        resultsEl.innerHTML = "";
        return;
      }
      resultsEl.innerHTML = skeleton(4).join("");
      try {
        const [unis, schs, countries, courses] = await Promise.all([
          fetchAPI(`/api/universities?search=${encodeURIComponent(q)}&limit=5`).catch(() => ({ universities: [] })),
          fetchAPI(`/api/scholarships?field=${encodeURIComponent(q)}&limit=5`).catch(() => ({ scholarships: [] })),
          fetchAPI(`/api/countries`).catch(() => ({ countries: [] })),
          fetchAPI(`/api/courses?limit=5`).catch(() => ({ courses: [] })),
        ]);
        const countryMatches = (countries.countries || []).filter(
          (c) => (c.name || "").toLowerCase().includes(q.toLowerCase()) || (c.code || "").includes(q.toLowerCase()),
        );
        const cards = [];
        for (const u of unis.universities || []) {
          cards.push(`<a class="card pad" href="/university-detail?slug=${encodeURIComponent(u.slug)}"><div class="h3">${u.name}</div><div class="caption">${u.city || ""} • ${u.country_name || ""}</div></a>`);
        }
        for (const c of (courses.courses || []).slice(0, 3)) {
          cards.push(`<a class="card pad" href="/course-detail?id=${encodeURIComponent(c.id)}"><div class="h3">${c.name}</div><div class="caption">${c.university_name || ""}</div></a>`);
        }
        for (const s of (schs.scholarships || []).slice(0, 3)) {
          cards.push(`<a class="card pad" href="/scholarships"><div class="h3">${s.name}</div><div class="caption">${s.provider || ""}</div></a>`);
        }
        for (const c of countryMatches.slice(0, 3)) {
          cards.push(`<a class="card pad" href="/country-detail?code=${encodeURIComponent(c.code)}"><div class="h3">${c.flag_emoji || ""} ${c.name}</div><div class="caption">${(c.currency || "").toUpperCase()}</div></a>`);
        }
        resultsEl.innerHTML = cards.length ? cards.join("") : `<div class="caption muted">No results.</div>`;
      } catch (e) {
        resultsEl.innerHTML = `<div class="card pad"><div class="h3">Search failed</div><div class="caption muted">${e.message || ""}</div></div>`;
      }
    }, 220);

    document.addEventListener("keydown", (e) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        open();
      }
    });

    document.addEventListener("input", (e) => {
      const target = e.target;
      if (target && target.id === "gsInput") search(target.value.trim());
    });
  }

  // Shortlist helpers (shared across pages)
  const SHORTLIST_KEY = "abroadready_shortlist_v1";
  function getShortlist() {
    try {
      return JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "{}");
    } catch {
      return {};
    }
  }

  async function syncShortlistFromDB() {
    try {
      const local = getShortlist();
      const data = await fetchAPI("/api/shortlist");
      
      if (data.ok) {
        if (data.kanban_state) {
          // If we have local data and DB data, we should ideally merge.
          // For simplicity, if DB has data, it wins (authoritative).
          // If DB is empty but local has data, push local to DB.
          const dbState = data.kanban_state;
          const localHasData = Object.values(local).some(arr => arr.length > 0);
          const dbHasData = Object.values(dbState).some(arr => arr.length > 0);

          if (!dbHasData && localHasData) {
            await saveShortlist(local);
            return local;
          } else {
            localStorage.setItem(SHORTLIST_KEY, JSON.stringify(dbState));
            return dbState;
          }
        } else {
          // No DB entry at all, push local if it exists
          const localHasData = Object.values(local).some(arr => arr.length > 0);
          if (localHasData) {
            await saveShortlist(local);
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync shortlist from DB:", e);
    }
    return getShortlist();
  }

  async function saveShortlist(state) {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(state));
    try {
      await fetchAPI("/api/shortlist/save", {
        method: "POST",
        body: JSON.stringify({ state }),
      });
    } catch (e) {
      console.warn("Could not save shortlist to DB:", e);
    }
  }

  async function addToShortlist(column, id, title, note = "", metadata = {}) {
    const state = getShortlist();
    state[column] = state[column] || [];
    if (state[column].find((it) => String(it.id) === String(id))) return false;
    state[column].unshift({ id, title, note, ...metadata });
    await saveShortlist(state);
    return true;
  }

  // Expose helpers
  window.AbroadReady = {
    fetchAPI,
    showToast,
    showModal,
    closeModal,
    formatINR,
    formatLocal,
    timeAgo,
    debounce,
    skeleton,
    shortlist: {
      get: getShortlist,
      save: saveShortlist,
      add: addToShortlist,
      sync: syncShortlistFromDB,
      columns: ["Researching", "Applying", "Applied", "Waiting", "Decision"],
    },
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const auth = await ensureAuthIfRequired();
    injectNav(auth.user || null);
    setActiveNav();
    loadForexTicker();
    bindGlobalSearch();

    if (auth.authed) {
      await syncShortlistFromDB();
      // Dispatch event so pages like shortlist.js know data is ready
      window.dispatchEvent(new CustomEvent("shortlistUpdated"));
    }
  });
})();
