(() => {
  const { fetchAPI, skeleton, showToast, timeAgo } = window.AbroadReady;
  const list = document.getElementById("list");

  function card(n) {
    return `
      <div class="card pad note">
        <div class="row" style="justify-content:space-between">
          <div class="h3">${n.title || n.type || "Notification"}</div>
          <span class="badge ${n.is_read ? "" : "info"}">${n.is_read ? "Read" : "Unread"}</span>
        </div>
        <div class="caption muted">${n.body || ""}</div>
        <div class="caption muted">${timeAgo(n.created_at || "")}</div>
        ${n.action_url ? `<a class="btn sm" href="${n.action_url}">Open</a>` : ""}
      </div>
    `;
  }

  async function load() {
    list.innerHTML = skeleton(4).join("");
    const data = await fetchAPI("/api/notifications");
    const rows = data.notifications || [];
    list.innerHTML = rows.length ? rows.map(card).join("") : `<div class="caption muted">No notifications yet.</div>`;
  }

  document.getElementById("markRead").addEventListener("click", async () => {
    try {
      await fetchAPI("/api/notifications/mark-all-read", { method: "POST" });
      showToast("Marked all read", "success");
      await load();
    } catch (e) {
      showToast(e.message || "Failed", "error");
    }
  });

  document.addEventListener("DOMContentLoaded", () => load().catch((e) => showToast(e.message, "error")));
})();

